/** Read-only OWNER verification. Pipe one UTF-8 password line; never pass it as an argument. */
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { verifyPasswordAsync } from "../src/lib/auth.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let db;
try {
  if (process.stdin.isTTY) throw new Error("Use the protected PowerShell launcher; interactive plaintext stdin is refused.");
  if (process.argv.length > 3) throw new Error("Expected only an optional database path.");
  const argument = process.argv[2] ?? path.join(repo, "prisma/dev.db");
  const filePath = argument.startsWith("file:") ? argument.slice(5) : argument;
  if (/[?#]/.test(filePath)) throw new Error("Provide a SQLite file path without URL parameters.");
  const databasePath = realpathSync(path.resolve(repo, filePath));
  const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
  if (/[\r\n]/.test(password) || password.length > 1024) throw new Error("Expected one password line of at most 1024 characters.");
  db = new DatabaseSync(databasePath, { readOnly: true });
  const user = db.prepare("SELECT passwordHash FROM User WHERE id = ?").get("owner");
  const ok = Boolean(password && user?.passwordHash && await verifyPasswordAsync(password, user.passwordHash));
  console.log(JSON.stringify({ ok, passwordLength: password.length }));
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  console.error(error?.code === "ENOENT" ? "Verification failed: database file does not exist." :
    error?.message?.startsWith("Use the protected") || error?.message?.startsWith("Expected") || error?.message?.startsWith("Provide a SQLite") ? error.message :
    "Verification failed: unable to read the OWNER record or password input.");
  process.exitCode = 2;
} finally {
  db?.close();
}
