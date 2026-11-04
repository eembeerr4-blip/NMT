/** Addressed q-u6 correction. Read-only by default; never seeds or regrades attempts. */
import { DatabaseSync, backup } from "node:sqlite";
import { closeSync, existsSync, fstatSync, linkSync, lstatSync, mkdtempSync, openSync, realpathSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const id = "q-u6";
const oldAnswer = "q-u6-А";
const newAnswer = "q-u6-Г";
const oldExplanation = "Після пів перед я, ю, є, ї ставиться апостроф.";
const newExplanation = "Невідмінюваний числівник пів зі значенням половини з іменником у родовому відмінку однини пишемо окремо: пів яблука (Український правопис, 2019, § 36).";
const expectedOptions = [["А", "пів'яблука"], ["Б", "півяблука"], ["В", "пів-яблука"], ["Г", "пів яблука"]];
const flags = new Set(["--apply", "--allow-working-db"]);
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (flags.has(key)) options[key] = true;
  else if (["--database", "--backup"].includes(key) && args[i + 1] && !args[i + 1].startsWith("--")) options[key] = args[++i];
  else throw new Error("Unknown or incomplete option: " + key);
}

function inspect(db) {
  const rows = db.prepare('SELECT * FROM Question WHERE id=?').all(id);
  if (rows.length !== 1) throw new Error("Expected exactly one q-u6 question");
  const q = rows[0];
  if (q.subjectId !== "ukrainian" || q.topicId !== "ukr-ortho" || q.type !== "SINGLE_CHOICE" || q.prompt !== "Оберіть правильне написання.") throw new Error("Unexpected question identity; no changes allowed");
  const actual = db.prepare('SELECT id,label,text FROM QuestionOption WHERE questionId=? ORDER BY sortOrder').all(id);
  if (actual.length !== expectedOptions.length || actual.some((o, index) => o.id !== `${id}-${expectedOptions[index][0]}` || o.label !== expectedOptions[index][0] || o.text !== expectedOptions[index][1])) throw new Error("Unexpected answer options; no changes allowed");
  const dependencies = {
    answers: db.prepare('SELECT COUNT(*) n FROM Answer WHERE questionId=?').get(id).n,
    tests: db.prepare('SELECT COUNT(*) n FROM TestQuestion WHERE questionId=?').get(id).n,
    attempts: db.prepare('SELECT COUNT(DISTINCT a.id) n FROM TestAttempt a JOIN TestQuestion tq ON tq.testId=a.testId WHERE tq.questionId=?').get(id).n,
    mistakes: db.prepare('SELECT COUNT(*) n FROM Mistake WHERE questionId=?').get(id).n,
  };
  if (q.correctAnswer === newAnswer && q.explanation === newExplanation) return { status: "already-correct", dependencies };
  if (q.correctAnswer !== oldAnswer || q.explanation !== oldExplanation) throw new Error("Unexpected current answer/explanation; no changes allowed");
  if (Object.values(dependencies).some(Boolean)) throw new Error("q-u6 has saved dependencies; separate review required");
  return { status: "eligible", dependencies };
}

function integrity(db) {
  const result = db.prepare("PRAGMA integrity_check").all();
  if (result.length !== 1 || result[0].integrity_check !== "ok" || db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("SQLite integrity or foreign keys failed");
}

async function createBackup(source, destination) {
  // Same-volume hard-link publication is atomic and refuses an existing destination on Windows.
  const directory = mkdtempSync(path.join(path.dirname(destination), ".q-u6-backup-"));
  const temporary = path.join(directory, "snapshot.db");
  let owned;
  try {
    const fd = openSync(temporary, "wx", 0o600);
    try { owned = fstatSync(fd); } finally { closeSync(fd); }
    await backup(source, temporary);
    const saved = new DatabaseSync(temporary);
    try {
      // Consolidate only the private copy so publication needs no WAL/SHM sidecars.
      saved.exec("PRAGMA journal_mode=DELETE");
      integrity(saved);
      inspect(saved);
    } finally { saved.close(); }
    // Unlike rename/backup, linkSync never replaces an existing file (including a racing creator).
    linkSync(temporary, destination);
  } finally {
    if (owned && existsSync(temporary)) {
      const current = lstatSync(temporary);
      if (current.isFile() && current.dev === owned.dev && current.ino === owned.ino) unlinkSync(temporary);
    }
    // Remove only our empty directory; never recursively delete unexpected files.
    rmdirSync(directory);
  }
}

async function main() {
  const requested = options["--database"];
  if (!requested || !path.isAbsolute(requested) || !existsSync(requested)) throw new Error("--database must explicitly name an existing absolute SQLite path");
  const database = realpathSync(requested);
  const working = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma/dev.db");
  const workingReal = existsSync(working) ? realpathSync(working) : working;
  const sourceInfo = statSync(database);
  const workingInfo = existsSync(workingReal) ? statSync(workingReal) : null;
  const isWorking = database.toLowerCase() === workingReal.toLowerCase() || (workingInfo && sourceInfo.dev === workingInfo.dev && sourceInfo.ino === workingInfo.ino);
  if (options["--apply"] && isWorking && !options["--allow-working-db"]) throw new Error("Working SQLite is protected; separate owner permission and --allow-working-db are required");
  const source = new DatabaseSync(database, { readOnly: true });
  let plan;
  let savedBackup;
  try {
    integrity(source);
    plan = inspect(source);
    if (options["--apply"] && plan.status === "eligible") {
      savedBackup = options["--backup"];
      if (!savedBackup || !path.isAbsolute(savedBackup)) throw new Error("--backup must name a new absolute file in an existing directory");
      savedBackup = path.join(realpathSync(path.dirname(savedBackup)), path.basename(savedBackup));
      if (savedBackup.toLowerCase() === database.toLowerCase()) throw new Error("Backup must differ from source");
      await createBackup(source, savedBackup);
    }
  } finally { source.close(); }
  if (!options["--apply"] || plan.status === "already-correct") return { ...plan, changed: false, readOnly: true };
  const db = new DatabaseSync(database);
  let transaction = false;
  try {
    db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
    transaction = true;
    const current = inspect(db);
    if (current.status !== "eligible") throw new Error("Question changed during preparation; stopped");
    const result = db.prepare('UPDATE Question SET correctAnswer=?, explanation=?, updatedAt=? WHERE id=? AND correctAnswer=? AND explanation=?').run(newAnswer, newExplanation, new Date().toISOString(), id, oldAnswer, oldExplanation);
    if (result.changes !== 1 || inspect(db).status !== "already-correct") throw new Error("Correction verification failed");
    integrity(db);
    db.exec("COMMIT");
    transaction = false;
    return { status: "updated", changed: true, questionId: id, dependencies: current.dependencies, backup: savedBackup, integrity: "ok" };
  } catch (error) {
    if (transaction) db.exec("ROLLBACK");
    throw error;
  } finally { db.close(); }
}

main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
