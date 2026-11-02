import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const prodDb = path.resolve("D:/НМТ Сайт/NMT-academy/prisma/dev.db");
const qaDb = path.resolve("D:/НМТ Сайт/NMT-stage7a-content/prisma/stage7-verify-automation-qa.db");

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function integrity(filePath) {
  const db = new DatabaseSync(filePath, { readOnly: true });
  const row = db.prepare("PRAGMA integrity_check").get();
  const fk = db.prepare("PRAGMA foreign_key_check").all();
  db.close();
  return { integrity: row, foreignKeyViolations: fk.length };
}

const prodShaBefore = sha256(prodDb);
copyFileSync(prodDb, qaDb);
const prodShaAfter = sha256(prodDb);
const qaSha = sha256(qaDb);

console.log(
  JSON.stringify(
    {
      prodDb,
      qaDb,
      prodShaBefore,
      prodShaAfter,
      prodUnchanged: prodShaBefore === prodShaAfter,
      qaSha,
      prodIntegrity: integrity(prodDb),
      qaIntegrity: integrity(qaDb),
      nextSteps: [
        "Set owner password on QA db only (not dev.db)",
        "Start NMT-academy dev with DATABASE_URL=file:.../stage7-verify-automation-qa.db on port 3011",
        "STAGE7_VERIFY_AUTOMATION_QA=yes STAGE7_RELEASE_VERIFY_LIMIT=1 STAGE7_PRODUCTION_BASE_URL=http://127.0.0.1:3011",
        "Run scripts/stage7-verify-automation-qa.mts via interactive PS1 launcher",
      ],
    },
    null,
    2,
  ),
);

if (!existsSync(qaDb)) {
  process.exitCode = 1;
}
