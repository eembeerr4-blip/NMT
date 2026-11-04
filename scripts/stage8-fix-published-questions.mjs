/** Stage 8 addressed correction: read-only unless explicitly applied with a verified backup. */
import { DatabaseSync, backup } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, linkSync, lstatSync, mkdtempSync, openSync, closeSync, readFileSync, realpathSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const planPath = path.join(root, "content/stage8/final-24-corrections.json");
const planDigest = "392291e34155131e2858850e99bb787915de1d1fb1bbdbebb388b155919ad36d";
export const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const quote = name => '"' + name.replaceAll('"', '""') + '"';
export function loadPlan() {
  const raw = readFileSync(planPath);
  if (createHash("sha256").update(raw).digest("hex") !== planDigest) throw Error("Reviewed plan digest mismatch");
  const plan = JSON.parse(raw);
  if (plan.changes.length !== 24 || new Set(plan.changes.map(c => c.id)).size !== 24) throw Error("Expected exactly 24 distinct IDs");
  return plan;
}
export function schemaHash(db) {
  return hash(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
}
export function tableHashes(db) {
  return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
    const rows = db.prepare("SELECT * FROM " + quote(name)).all().map(r => JSON.stringify(r)).sort();
    return [name, { rows: rows.length, sha256: hash(rows) }];
  }));
}
export function integrity(db) {
  const checks = db.prepare("PRAGMA integrity_check").all();
  if (checks.length !== 1 || checks[0].integrity_check !== "ok" || db.prepare("PRAGMA foreign_key_check").all().length) throw Error("SQLite integrity/FK check failed");
}
function expectedOptions(c) {
  return c.options.map(o => ({ ...o, text: c.optionChanges.find(n => n.id === o.id)?.text ?? o.text }));
}
export function inspect(db, plan) {
  if (schemaHash(db) !== plan.schemaSha256) throw Error("Unexpected database schema");
  for (const t of plan.topics) {
    const row = db.prepare("SELECT * FROM Topic WHERE id=?").get(t.id);
    if (!row || row.coverage !== "READY" || hash(row) !== t.sha256) throw Error("Topic precondition failed: " + t.id);
  }
  const rows = plan.changes.map(c => {
    const q = db.prepare("SELECT * FROM Question WHERE id=?").get(c.id);
    const options = db.prepare("SELECT * FROM QuestionOption WHERE questionId=? ORDER BY sortOrder,id").all(c.id);
    if (!q || q.topicId !== c.topicId || q.subjectId !== c.subjectId || q.type !== "SINGLE_CHOICE" || q.verificationStatus !== "VERIFIED") throw Error("Question identity/status failed: " + c.id);
    if (c.optionChanges.some(n => !c.options.some(o => o.id === n.id)) || !options.some(o => o.id === c.after.correctAnswer)) throw Error("Option identity failed: " + c.id);
    const dependencies = Object.fromEntries(["TestQuestion", "Answer", "Mistake"].map(table => [table, db.prepare("SELECT COUNT(*) n FROM " + table + " WHERE questionId=?").get(c.id).n]));
    const old = hash(q) === c.expectedRowSha256 && hash(options) === c.expectedOptionsSha256;
    const applied = same({ ...q, updatedAt: c.before.updatedAt }, { ...c.before, ...c.after }) && same(options, expectedOptions(c));
    if (!old && !applied) throw Error("Question/options hash mismatch: " + c.id);
    return { id: c.id, state: old ? "before" : "after", dependencies };
  });
  const before = rows.filter(r => r.state === "before").length;
  if (before !== 0 && before !== 24) throw Error("Mixed/partial correction state; no automatic continuation");
  if (before && rows.some(r => Object.values(r.dependencies).some(Boolean))) throw Error("Saved question dependencies exist; separate review required");
  return { status: before ? "eligible" : "already-correct", rows };
}
export async function createBackup(source, destination) {
  if (!path.isAbsolute(destination)) throw Error("Backup path must be absolute");
  const final = path.join(realpathSync(path.dirname(destination)), path.basename(destination));
  const folder = mkdtempSync(path.join(path.dirname(final), ".stage8-backup-"));
  const temporary = path.join(folder, "snapshot.db");
  let owned;
  try {
    const fd = openSync(temporary, "wx", 0o600);
    closeSync(fd);
    owned = lstatSync(temporary);
    await backup(source, temporary);
    const saved = new DatabaseSync(temporary);
    try { saved.exec("PRAGMA journal_mode=DELETE"); integrity(saved); } finally { saved.close(); }
    linkSync(temporary, final); // Atomic publication, EEXIST on Windows; never overwrite a racing creator.
    return final;
  } finally {
    if (owned && existsSync(temporary)) {
      const now = lstatSync(temporary);
      if (now.isFile() && now.dev === owned.dev && now.ino === owned.ino) unlinkSync(temporary);
    }
    rmdirSync(folder); // Only our empty directory; never recursive cleanup of unexpected files.
  }
}
/** Caller holds BEGIN IMMEDIATE. Every change is checked again before COMMIT. */
export function applyPlan(db, plan) {
  if (inspect(db, plan).status !== "eligible") throw Error("Expected eligible preconditions");
  const before = tableHashes(db);
  const oldQuestions = db.prepare("SELECT * FROM Question").all();
  const oldOptions = db.prepare("SELECT * FROM QuestionOption").all();
  const stamp = Date.now();
  let optionCount = 0;
  for (const c of plan.changes) {
    if (db.prepare("UPDATE Question SET prompt=?,explanation=?,correctAnswer=?,updatedAt=? WHERE id=?").run(c.after.prompt, c.after.explanation, c.after.correctAnswer, stamp, c.id).changes !== 1) throw Error("Question row count mismatch");
    for (const o of c.optionChanges) {
      if (db.prepare("UPDATE QuestionOption SET text=? WHERE id=? AND questionId=?").run(o.text, o.id, c.id).changes !== 1) throw Error("Option row count mismatch");
      optionCount++;
    }
  }
  if (inspect(db, plan).status !== "already-correct") throw Error("Post-update validation failed");
  const actualQ = db.prepare("SELECT * FROM Question").all();
  const actualO = db.prepare("SELECT * FROM QuestionOption").all();
  const expectedQ = oldQuestions.map(q => { const c = plan.changes.find(c => c.id === q.id); return c ? { ...q, ...c.after, updatedAt: stamp } : q; });
  const expectedO = oldOptions.map(o => { const n = plan.changes.flatMap(c => c.optionChanges).find(n => n.id === o.id); return n ? { ...o, text: n.text } : o; });
  const unordered = rows => rows.map(r => JSON.stringify(r)).sort();
  if (!same(unordered(actualQ), unordered(expectedQ)) || !same(unordered(actualO), unordered(expectedO))) throw Error("Unexpected question/option changes");
  const after = tableHashes(db);
  for (const table of Object.keys(before)) if (!["Question", "QuestionOption"].includes(table) && !same(before[table], after[table])) throw Error("Unexpected change in " + table);
  integrity(db);
  return { questions: 24, questionOptions: optionCount, unchangedOtherTables: Object.keys(before).length - 2 };
}
function isWorking(database) {
  const working = path.join(root, "prisma/dev.db");
  if (!existsSync(working)) return false;
  const a = statSync(database), b = statSync(working);
  return realpathSync(database).toLowerCase() === realpathSync(working).toLowerCase() || (a.dev === b.dev && a.ino === b.ino);
}
export async function runUpdate({ database, apply = false, allowWorkingDb = false, backupFile }) {
  if (!database || !path.isAbsolute(database) || !existsSync(database)) throw Error("Explicit existing absolute --database path required");
  const resolved = realpathSync(database), plan = loadPlan();
  if (apply && isWorking(resolved) && !allowWorkingDb) throw Error("Working database protected; separate owner approval required");
  const source = new DatabaseSync(resolved, { readOnly: true });
  let inspection, savedBackup, backupHashes;
  try {
    source.exec("BEGIN");
    integrity(source);
    inspection = inspect(source, plan);
    if (!apply || inspection.status === "already-correct") return { ...inspection, changed: false, readOnly: true };
    if (!backupFile) throw Error("--backup required before any update");
    savedBackup = await createBackup(source, backupFile);
    const saved = new DatabaseSync(savedBackup, { readOnly: true });
    try {
      if (inspect(saved, plan).status !== "eligible") throw Error("Backup precondition mismatch");
      backupHashes = tableHashes(saved);
      if (!same(tableHashes(source), backupHashes)) throw Error("Backup/source mismatch");
    } finally { saved.close(); }
  } finally { source.close(); }
  const db = new DatabaseSync(resolved);
  let transaction = false;
  try {
    db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE"); transaction = true;
    if (!same(tableHashes(db), backupHashes)) throw Error("Database changed since backup; stopped without retry");
    const changed = applyPlan(db, plan);
    db.exec("COMMIT"); transaction = false;
    return { status: "updated", changed, backup: savedBackup, integrity: "ok", foreignKeyViolations: 0 };
  } catch (error) {
    if (transaction) db.exec("ROLLBACK");
    throw error;
  } finally { db.close(); }
}
async function cli() {
  const result = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (["--apply", "--allow-working-db"].includes(key)) {
      const name = key === "--apply" ? "apply" : "allowWorkingDb";
      if (name in result) throw Error("Duplicate option"); result[name] = true;
    } else if (["--database", "--backup"].includes(key) && args[i + 1] && !args[i + 1].startsWith("--")) {
      const name = key === "--database" ? "database" : "backupFile";
      if (name in result) throw Error("Duplicate option"); result[name] = args[++i];
    } else throw Error("Unknown/incomplete option: " + key);
  }
  console.log(JSON.stringify(await runUpdate(result)));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli().catch(error => { console.error(error.message); process.exitCode = 1; });
