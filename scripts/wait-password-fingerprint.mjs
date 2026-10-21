import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const dbPath = path.resolve(process.argv[2] ?? "");
const before = process.argv[3] ?? "";
const timeoutMs = Number(process.argv[4] ?? 180_000);
const intervalMs = 5_000;

function fingerprint(db) {
  const owner = db.prepare('SELECT passwordHash FROM "User" WHERE id = ?').get("owner");
  if (!owner?.passwordHash) return null;
  return createHash("sha256").update(owner.passwordHash).digest("hex").slice(0, 16);
}

const started = Date.now();
while (Date.now() - started < timeoutMs) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const current = fingerprint(db);
  db.close();
  if (current && current !== before) {
    console.log(JSON.stringify({ changed: true, fingerprint: current }, null, 2));
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
console.log(JSON.stringify({ changed: false }, null, 2));
process.exit(1);
