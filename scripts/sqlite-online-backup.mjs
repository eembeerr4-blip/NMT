/**
 * Consistent SQLite backup with WAL checkpoint (Node built-in sqlite).
 * Usage: node scripts/sqlite-online-backup.mjs --source "D:/.../prisma/dev.db" --dest "D:/.../backups/dev-YYYYMMDD-HHMM.db"
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = { source: "", dest: "" };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--source") options.source = argv[++index] ?? "";
    else if (token === "--dest") options.dest = argv[++index] ?? "";
  }
  return options;
}

const { source, dest } = parseArgs(process.argv.slice(2));
if (!source || !dest) {
  console.error("Usage: node scripts/sqlite-online-backup.mjs --source <absolute.db> --dest <absolute-backup.db>");
  process.exit(1);
}

const sourcePath = path.resolve(source);
const destPath = path.resolve(dest);
mkdirSync(path.dirname(destPath), { recursive: true });

const db = new DatabaseSync(sourcePath);
db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
db.prepare("VACUUM INTO ?").run(destPath);
db.close();

console.log(JSON.stringify({ ok: true, source: sourcePath, dest: destPath }, null, 2));
