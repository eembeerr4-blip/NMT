import { execFileSync, fork } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { questions } from "../prisma/questions";

const folder = mkdtempSync(path.join(tmpdir(), "nmt-q-u6-"));
const base = path.join(folder, "base.db");
const script = path.join(process.cwd(), "scripts/fix-q-u6.mjs");
const oldExplanation = "Після пів перед я, ю, є, ї ставиться апостроф.";
const expected = questions.find(q => q.id === "q-u6")!;
let serial = 0;
function fixture() { const file = path.join(folder, `case-${serial++}.db`); copyFileSync(base, file); return file; }
function run(file: string, ...args: string[]) { return JSON.parse(execFileSync(process.execPath, [script, "--database", file, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
function snapshot(file: string) { const db = new DatabaseSync(file, { readOnly: true }); try { return { questions: db.prepare("SELECT * FROM Question ORDER BY id").all(), options: db.prepare("SELECT * FROM QuestionOption ORDER BY id").all() }; } finally { db.close(); } }

beforeAll(async () => {
  writeFileSync(base, "");
  const url = "file:" + base.replaceAll("\\", "/");
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", timeout: 60000 });
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    await db.subject.create({ data: { id: "ukrainian", name: "QA", shortName: "QA", description: "QA", color: "blue", sortOrder: 0 } });
    await db.topic.create({ data: { id: "ukr-ortho", subjectId: "ukrainian", title: "QA", sortOrder: 0 } });
    const { options, ...question } = expected;
    await db.question.create({ data: { ...question, correctAnswer: "q-u6-А", explanation: oldExplanation, options: { create: options } } });
    await db.question.create({ data: { id: "other-question", subjectId: "ukrainian", topicId: "ukr-ortho", type: "NUMERIC", difficulty: "EASY", prompt: "QA other question", correctAnswer: "2", explanation: "QA untouched" } });
  } finally { await db.$disconnect(); }
}, 60000);
afterAll(() => { if (!path.resolve(folder).startsWith(path.resolve(tmpdir()) + path.sep + "nmt-q-u6-")) throw new Error("Unexpected cleanup path"); rmSync(folder, { recursive: true }); });

it("defaults to a read-only precheck", () => {
  const file = fixture(); const before = snapshot(file);
  expect(run(file)).toMatchObject({ status: "eligible", changed: false, readOnly: true });
  expect(snapshot(file)).toEqual(before);
});

it("changes only q-u6, verifies the backup, and is idempotent", () => {
  const file = fixture(); const backup = path.join(folder, "verified-backup.db"); const before = snapshot(file);
  expect(run(file, "--apply", "--backup", backup)).toMatchObject({ status: "updated", changed: true, integrity: "ok" });
  const after = snapshot(file);
  expect(after.options).toEqual(before.options);
  expect(after.questions.find(q => q.id === "other-question")).toEqual(before.questions.find(q => q.id === "other-question"));
  expect(after.questions.find(q => q.id === "q-u6")).toMatchObject({ correctAnswer: expected.correctAnswer, explanation: expected.explanation });
  expect(snapshot(backup)).toEqual(before);
  const bytes = readFileSync(backup);
  expect(run(file, "--apply", "--backup", backup)).toMatchObject({ status: "already-correct", changed: false });
  expect(snapshot(file)).toEqual(after);
  expect(readFileSync(backup)).toEqual(bytes);
});

it("refuses a question already referenced by a test", () => {
  const file = fixture(); const db = new DatabaseSync(file);
  db.exec("INSERT INTO Test(id,title,kind) VALUES('used-test','QA','PRACTICE'); INSERT INTO TestQuestion(id,testId,questionId,sortOrder) VALUES('used-question','used-test','q-u6',0)"); db.close();
  const before = snapshot(file);
  expect(() => run(file, "--apply", "--backup", path.join(folder, "refused.db"))).toThrow();
  expect(snapshot(file)).toEqual(before);
});

it("refuses changed preconditions", () => {
  const file = fixture(); const db = new DatabaseSync(file);
  db.prepare("UPDATE QuestionOption SET text='Unexpected' WHERE id=?").run("q-u6-А"); db.close();
  const before = snapshot(file);
  expect(() => run(file, "--apply", "--backup", path.join(folder, "unexpected.db"))).toThrow();
  expect(snapshot(file)).toEqual(before);
});

it("rolls back on a write failure without restoring or altering other content", () => {
  const file = fixture(); const db = new DatabaseSync(file);
  db.exec("CREATE TRIGGER qa_fail_q_u6 BEFORE UPDATE ON Question WHEN NEW.id='q-u6' BEGIN SELECT RAISE(ABORT,'QA injected failure'); END;"); db.close();
  const before = snapshot(file);
  expect(() => run(file, "--apply", "--backup", path.join(folder, "failed-write-backup.db"))).toThrow();
  expect(snapshot(file)).toEqual(before);
});

function noTemporaryBackups() {
  expect(readdirSync(folder).filter(name => name.startsWith(".q-u6-backup-"))).toEqual([]);
}

// Test-only preload pauses real child processes immediately before atomic publication.
// No coordination flags or test hooks are added to the production script.
function heldProcess(file: string, destination: string) {
  const tag = serial++;
  const gate = path.join(folder, `release-${tag}`);
  const hook = path.join(folder, `hold-${tag}.mjs`);
  writeFileSync(hook, `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const publish = fs.linkSync;
    fs.linkSync = (...args) => {
      process.send('ready');
      const deadline = Date.now() + 15000;
      const wait = new Int32Array(new SharedArrayBuffer(4));
      while (!fs.existsSync(process.env.NMT_QA_BACKUP_GATE)) {
        if (Date.now() > deadline) throw new Error('QA publication gate timed out');
        Atomics.wait(wait, 0, 0, 10);
      }
      return publish(...args);
    };
    syncBuiltinESMExports();
  `);
  const child = fork(script, ["--database", file, "--apply", "--backup", destination], {
    execArgv: ["--import", pathToFileURL(hook).href],
    env: { ...process.env, NMT_QA_BACKUP_GATE: gate },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let stdout = ""; let stderr = ""; let reached = false;
  child.stdout!.on("data", chunk => { stdout += chunk; });
  child.stderr!.on("data", chunk => { stderr += chunk; });
  const ready = new Promise<void>((resolve, reject) => {
    child.on("message", message => { if (message === "ready") { reached = true; resolve(); } });
    child.once("error", reject);
    child.once("exit", code => { if (!reached) reject(new Error(`Child exited before publication: ${code}: ${stderr}`)); });
  });
  const done = new Promise<{ code: number | null; stdout: string; stderr: string }>(resolve => {
    child.once("exit", code => resolve({ code, stdout, stderr }));
  });
  return { child, ready, done, release: () => writeFileSync(gate, "release") };
}

it("never changes an already existing backup, including its bytes", () => {
  const file = fixture(); const destination = path.join(folder, "existing-backup.db");
  const bytes = Buffer.from("QA foreign backup: preserve every byte\0\xff", "latin1");
  writeFileSync(destination, bytes);
  const before = snapshot(file);
  expect(() => run(file, "--apply", "--backup", destination)).toThrow();
  expect(readFileSync(destination)).toEqual(bytes);
  expect(snapshot(file)).toEqual(before);
  noTemporaryBackups();
});

it("two competing processes publish exactly one backup without overwriting each other", async () => {
  const files = [fixture(), fixture()];
  for (const [index, file] of files.entries()) {
    const db = new DatabaseSync(file);
    db.prepare("UPDATE Question SET explanation=? WHERE id='other-question'").run(`QA source ${index}`);
    db.close();
  }
  const before = files.map(snapshot);
  const destination = path.join(folder, "concurrent-backup.db");
  const processes = files.map(file => heldProcess(file, destination));
  try {
    await Promise.all(processes.map(p => p.ready));
    processes.forEach(p => p.release());
    const results = await Promise.all(processes.map(p => p.done));
    expect(results.map(r => r.code).sort()).toEqual([0, 1]);
    const winner = results.findIndex(r => r.code === 0);
    const loser = 1 - winner;
    expect(JSON.parse(results[winner].stdout)).toMatchObject({ status: "updated", changed: true });
    expect(results[loser].stderr).toContain("EEXIST");
    expect(snapshot(destination)).toEqual(before[winner]);
    expect(snapshot(files[loser])).toEqual(before[loser]);
    expect(snapshot(files[winner]).questions.find(q => q.id === "q-u6")).toMatchObject({ correctAnswer: expected.correctAnswer });
    noTemporaryBackups();
  } finally {
    for (const p of processes) if (p.child.exitCode === null && p.child.signalCode === null) p.child.kill();
    await Promise.all(processes.map(p => p.done));
  }
}, 20000);

it("preserves a foreign file created while backup publication is pending", async () => {
  const file = fixture(); const before = snapshot(file);
  const destination = path.join(folder, "racing-foreign-backup.db");
  const process = heldProcess(file, destination);
  try {
    await process.ready;
    const bytes = Buffer.from("QA concurrent creator owns this destination\0\xfe", "latin1");
    writeFileSync(destination, bytes, { flag: "wx" });
    process.release();
    const result = await process.done;
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("EEXIST");
    expect(readFileSync(destination)).toEqual(bytes);
    expect(snapshot(file)).toEqual(before);
    noTemporaryBackups();
  } finally {
    if (process.child.exitCode === null && process.child.signalCode === null) process.child.kill();
    await process.done;
  }
}, 20000);

it("cleans its own incomplete temporary backup and never updates the source on backup failure", () => {
  const file = fixture(); const before = snapshot(file);
  const destination = path.join(folder, "failed-backup.db");
  const hook = path.join(folder, "fail-backup.mjs");
  writeFileSync(hook, `
    import fs from 'node:fs';
    import { createRequire, syncBuiltinESMExports } from 'node:module';
    const sqlite = createRequire(import.meta.url)('node:sqlite');
    sqlite.backup = async (_source, target) => {
      fs.writeFileSync(target, 'QA incomplete backup');
      throw new Error('QA injected backup failure');
    };
    syncBuiltinESMExports();
  `);
  let failure = "";
  try {
    execFileSync(process.execPath, ["--import", pathToFileURL(hook).href, script, "--database", file, "--apply", "--backup", destination], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) { failure = String((error as { stderr?: Buffer }).stderr ?? ""); }
  expect(failure).toContain("QA injected backup failure");
  expect(existsSync(destination)).toBe(false);
  expect(snapshot(file)).toEqual(before);
  noTemporaryBackups();
});

it("backs up committed WAL data before checkpoint while the source connection stays open", () => {
  const file = fixture(); const destination = path.join(folder, "wal-backup.db");
  const writer = new DatabaseSync(file);
  try {
    writer.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0");
    const mainBeforeWalWrite = readFileSync(file);
    writer.prepare("UPDATE Question SET explanation=? WHERE id='other-question'").run("QA committed, WAL only, not checkpointed");
    expect(existsSync(file + "-wal")).toBe(true);
    expect(statSync(file + "-wal").size).toBeGreaterThan(32);
    expect(readFileSync(file)).toEqual(mainBeforeWalWrite);
    const before = snapshot(file);
    expect(run(file, "--apply", "--backup", destination)).toMatchObject({ status: "updated", integrity: "ok" });
    expect(snapshot(destination)).toEqual(before);
    expect(readFileSync(file)).toEqual(mainBeforeWalWrite);
    expect(existsSync(destination + "-wal")).toBe(false);
    expect(existsSync(destination + "-shm")).toBe(false);
    expect(snapshot(destination).questions.find(q => q.id === "other-question")).toMatchObject({ explanation: "QA committed, WAL only, not checkpointed" });
    const saved = new DatabaseSync(destination, { readOnly: true });
    try {
      expect(saved.prepare("PRAGMA integrity_check").get()?.integrity_check).toBe("ok");
      expect(saved.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { saved.close(); }
    expect(snapshot(file).questions.find(q => q.id === "q-u6")).toMatchObject({ correctAnswer: expected.correctAnswer });
    expect(snapshot(file).questions.find(q => q.id === "other-question")).toEqual(before.questions.find(q => q.id === "other-question"));
    noTemporaryBackups();
  } finally { writer.close(); }
});
