/**
 * Read-only DB snapshot for backup/reset verification. No secrets in output.
 */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

function parseArgs(argv) {
  const options = { database: "", label: "snapshot" };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--database") options.database = argv[++index] ?? "";
    else if (token === "--label") options.label = argv[++index] ?? "snapshot";
  }
  return options;
}

const { database, label } = parseArgs(process.argv.slice(2));
if (!database) {
  console.error("Usage: node scripts/db-snapshot.mjs --database <absolute.db> [--label name]");
  process.exit(1);
}

const dbPath = path.resolve(database);
const db = new DatabaseSync(dbPath, { readOnly: true });

const integrity = String(db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
const fkIssues = db.prepare("PRAGMA foreign_key_check").all();
const owner = db.prepare('SELECT id, nickname, role, email, passwordHash FROM "User" WHERE id = ?').get("owner");
const counts = {
  users: Number(db.prepare('SELECT COUNT(*) AS c FROM "User"').get().c),
  sessions: Number(db.prepare('SELECT COUNT(*) AS c FROM "Session"').get().c),
  ownerSessions: Number(db.prepare('SELECT COUNT(*) AS c FROM "Session" WHERE userId = ?').get("owner").c),
  studyTasks: Number(db.prepare('SELECT COUNT(*) AS c FROM "StudyTask"').get().c),
  testAttempts: Number(db.prepare('SELECT COUNT(*) AS c FROM "TestAttempt"').get().c),
  subjects: Number(db.prepare('SELECT COUNT(*) AS c FROM "Subject"').get().c),
};

const passwordFingerprint = owner?.passwordHash
  ? createHash("sha256").update(owner.passwordHash).digest("hex").slice(0, 16)
  : null;

db.close();

console.log(
  JSON.stringify(
    {
      label,
      database: dbPath,
      integrityOk: integrity === "ok",
      integrity,
      foreignKeyIssueCount: fkIssues.length,
      owner: owner
        ? {
            id: owner.id,
            nickname: owner.nickname,
            role: owner.role,
            hasEmail: Boolean(owner.email),
            passwordFingerprint,
          }
        : null,
      counts,
    },
    null,
    2,
  ),
);

if (integrity !== "ok" || fkIssues.length > 0) process.exitCode = 1;
