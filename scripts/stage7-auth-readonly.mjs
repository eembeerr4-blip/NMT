import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(path.join(repo, "prisma", "dev.db"));
const owner = db
  .prepare(
    `SELECT id, nickname, role, email, emailVerifiedAt, length(passwordHash) AS hashLen FROM User WHERE id = 'owner'`,
  )
  .get();
const recent = db
  .prepare(`SELECT action, createdAt FROM AuditLog WHERE action LIKE 'AUTH_%' ORDER BY createdAt DESC LIMIT 10`)
  .all();
console.log(JSON.stringify({ owner, recentAuth: recent }, null, 2));
db.close();
