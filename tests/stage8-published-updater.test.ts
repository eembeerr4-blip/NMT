import { afterAll, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyPlan, createBackup, hash, inspect, integrity, loadPlan, schemaHash, tableHashes } from "../scripts/stage8-fix-published-questions.mjs";
import { gradeAnswer } from "@/lib/grade";

const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage8-updater-"));
let serial = 0;
type ReviewedPlan = typeof import("../content/stage8/final-24-corrections.json");
const original = loadPlan() as ReviewedPlan;
function fixture() {
  const file = path.join(folder, `case-${serial++}.db`);
  const db = new DatabaseSync(file);
  const q = original.changes[0].before, o = original.changes[0].options[0];
  const columns = (row: Record<string, unknown>) => Object.entries(row).map(([key, value]) => `"${key}" ${typeof value === "number" ? "INTEGER" : "TEXT"}${key === "id" ? " PRIMARY KEY" : ""}`).join(",");
  db.exec(`CREATE TABLE Question(${columns(q)}); CREATE TABLE QuestionOption(${columns(o)}); CREATE TABLE Topic(id TEXT PRIMARY KEY,coverage TEXT); CREATE TABLE TestQuestion(id TEXT PRIMARY KEY,questionId TEXT); CREATE TABLE Answer(id TEXT PRIMARY KEY,questionId TEXT); CREATE TABLE Mistake(id TEXT PRIMARY KEY,questionId TEXT); CREATE TABLE Sentinel(id TEXT PRIMARY KEY,value TEXT); INSERT INTO Sentinel VALUES('untouched','original');`);
  const plan = structuredClone(original);
  for (const row of plan.topics) db.prepare("INSERT INTO Topic VALUES(?,?)").run(row.id, row.coverage);
  plan.topics = plan.topics.map(t => ({ ...t, sha256: hash(db.prepare("SELECT * FROM Topic WHERE id=?").get(t.id)) }));
  const insert = (table: string, row: Record<string, unknown>) => db.prepare(`INSERT INTO ${table} VALUES(${Object.keys(row).map(() => "?").join(",")})`).run(...Object.values(row) as (string | number | null)[]);
  for (const c of plan.changes) { insert("Question", c.before); for (const row of c.options) insert("QuestionOption", row); }
  plan.schemaSha256 = schemaHash(db);
  return { db, file, plan };
}
function transaction(db: DatabaseSync, plan: ReviewedPlan) {
  db.exec("BEGIN IMMEDIATE");
  try { const result = applyPlan(db, plan); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
afterAll(() => {
  const resolved = path.resolve(folder);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("nmt-stage8-updater-")) throw Error("Unsafe cleanup");
  rmSync(resolved, { recursive: true });
});
it("pins exactly the 24 reviewed IDs and independently solves the quadratic", () => {
  expect(original.changes).toHaveLength(24);
  expect(new Set(original.changes.map(c => c.id)).size).toBe(24);
  const roots = [(7 - Math.sqrt(49 - 40)) / 2, (7 + Math.sqrt(49 - 40)) / 2];
  expect(roots).toEqual([2, 5]); expect(roots.reduce((a, b) => a + b)).toBe(7);
});
it.each(original.changes)("checks final grading and every distractor for $id", c => {
  const keys = c.options.map(o => ({ ...o, text: c.optionChanges.find(n => n.id === o.id)?.text ?? o.text }));
  expect(new Set(keys.map(o => o.text)).size).toBe(keys.length);
  for (const option of keys) expect(gradeAnswer({ type: "SINGLE_CHOICE", correctAnswer: c.after.correctAnswer, userAnswer: option.id }).isCorrect).toBe(option.id === c.after.correctAnswer);
});
it("read-only inspection changes no table", () => {
  const { db, plan } = fixture(); try { const before = tableHashes(db); expect(inspect(db, plan).status).toBe("eligible"); expect(tableHashes(db)).toEqual(before); } finally { db.close(); }
});
it("atomically changes 24 questions and 21 option texts, preserves all IDs/statuses and recognizes a repeat", () => {
  const { db, plan } = fixture(); try {
    expect(transaction(db, plan)).toMatchObject({ questions: 24, questionOptions: 21 });
    expect(inspect(db, plan).status).toBe("already-correct");
    expect(db.prepare("SELECT value FROM Sentinel").get()?.value).toBe("original");
    expect(db.prepare("SELECT count(*) n FROM Question WHERE verificationStatus='VERIFIED'").get()?.n).toBe(24);
    expect(db.prepare("SELECT count(*) n FROM Topic WHERE coverage='READY'").get()?.n).toBe(7);
    const after = tableHashes(db); expect(() => transaction(db, plan)).toThrow("Expected eligible"); expect(tableHashes(db)).toEqual(after); integrity(db);
  } finally { db.close(); }
});
it.each(["TestQuestion", "Answer", "Mistake"])("blocks existing %s without modifying anything", table => {
  const { db, plan } = fixture(); try { db.prepare(`INSERT INTO ${table} VALUES('dependency',?)`).run(plan.changes[0].id); const before = tableHashes(db); expect(() => transaction(db, plan)).toThrow("dependencies"); expect(tableHashes(db)).toEqual(before); } finally { db.close(); }
});
it.each(["prompt", "correctAnswer", "updatedAt"])("rejects stale Question.%s", field => {
  const { db, plan } = fixture(); try { db.prepare(`UPDATE Question SET ${field}=? WHERE id=?`).run(field === "updatedAt" ? 1 : "unexpected", plan.changes[0].id); const before = tableHashes(db); expect(() => transaction(db, plan)).toThrow("hash mismatch"); expect(tableHashes(db)).toEqual(before); } finally { db.close(); }
});
it("rejects stale options and changed topic even with matching question keys", () => {
  const { db, plan } = fixture(); try {
    db.prepare("UPDATE QuestionOption SET text='unexpected' WHERE id=?").run(plan.changes[0].options[0].id); expect(() => inspect(db, plan)).toThrow("hash mismatch");
    db.prepare("UPDATE Topic SET coverage='DRAFT' WHERE id=?").run(plan.topics[0].id); expect(() => inspect(db, plan)).toThrow("Topic precondition");
  } finally { db.close(); }
});
it("rolls back early updates if the last row fails", () => {
  const { db, plan } = fixture(); try {
    db.exec(`CREATE TRIGGER fail_last BEFORE UPDATE ON Question WHEN OLD.id='${plan.changes.at(-1)!.id}' BEGIN SELECT RAISE(ABORT,'last row failure'); END`);
    plan.schemaSha256 = schemaHash(db); const before = tableHashes(db);
    expect(() => transaction(db, plan)).toThrow("last row failure"); expect(tableHashes(db)).toEqual(before);
  } finally { db.close(); }
});
it("rolls back a trigger touching an unrelated table", () => {
  const { db, plan } = fixture(); try {
    db.exec("CREATE TRIGGER unexpected AFTER UPDATE ON Question BEGIN UPDATE Sentinel SET value='bad'; END"); plan.schemaSha256 = schemaHash(db);
    const before = tableHashes(db); expect(() => transaction(db, plan)).toThrow("Unexpected change"); expect(tableHashes(db)).toEqual(before);
  } finally { db.close(); }
});
it("rejects partially applied content", () => {
  const { db, plan } = fixture(); try {
    const c = plan.changes[0]; db.prepare("UPDATE Question SET prompt=?, explanation=?, correctAnswer=? WHERE id=?").run(c.after.prompt,c.after.explanation,c.after.correctAnswer,c.id);
    expect(() => inspect(db, plan)).toThrow("Mixed/partial");
  } finally { db.close(); }
});
it("online backup includes active WAL and refuses a preexisting destination byte-for-byte", async () => {
  const { db, plan } = fixture(); try {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; INSERT INTO Sentinel VALUES('wal','latest')"); expect(statSync(db.location()! + "-wal").size).toBeGreaterThan(0);
    const destination = path.join(folder, "wal-backup.db"); await createBackup(db, destination);
    const saved = new DatabaseSync(destination, { readOnly: true }); try { integrity(saved); expect(tableHashes(saved)).toEqual(tableHashes(db)); expect(inspect(saved, plan).status).toBe("eligible"); } finally { saved.close(); }
    const bytes = readFileSync(destination), before = tableHashes(db); await expect(createBackup(db,destination)).rejects.toThrow(); expect(readFileSync(destination)).toEqual(bytes); expect(tableHashes(db)).toEqual(before);
  } finally { db.close(); }
});
it("two concurrent online backups publish exactly one file without overwriting", async () => {
  const a = fixture(), b = fixture(), destination = path.join(folder, "race.db");
  try { const outcomes = await Promise.allSettled([createBackup(a.db,destination),createBackup(b.db,destination)]); expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(outcomes.filter(r => r.status === "rejected")).toHaveLength(1); const saved = new DatabaseSync(destination,{readOnly:true}); try { integrity(saved); } finally { saved.close(); } } finally { a.db.close(); b.db.close(); }
});
it("preserves a foreign destination file and leaves source questions unchanged", async () => {
  const {db} = fixture(); try { const destination = path.join(folder,"foreign.db"); const bytes = Buffer.from("foreign-owned-file"); writeFileSync(destination,bytes,{flag:"wx"}); const before = tableHashes(db); await expect(createBackup(db,destination)).rejects.toThrow(); expect(readFileSync(destination)).toEqual(bytes); expect(tableHashes(db)).toEqual(before); } finally { db.close(); }
});
