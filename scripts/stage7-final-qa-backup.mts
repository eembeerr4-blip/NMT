/**
 * Fresh QA SQLite from production via SQLite backup API + strict path isolation.
 */
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { resolveSqliteFilePath } from "../src/lib/stage7a-production-guard";
import { STAGE7_PRODUCTION_DB } from "./stage7-final-production-path.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionPath = path.normalize(STAGE7_PRODUCTION_DB);

function shaFile(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function main() {
  if (!statSync(productionPath).isFile()) {
    throw new Error(`Production DB missing: ${productionPath}`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join("D:/НМТ Сайт/backups", `stage7-final-qa-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const qaDb = path.join(dir, "stage7-final-qa.db");
  const productionSha = shaFile(productionPath);

  const db = new DatabaseSync(productionPath);
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    db.prepare("VACUUM INTO ?").run(qaDb);
  } finally {
    db.close();
  }

  const databaseUrl = `file:${qaDb.replace(/\\/g, "/")}`;
  const resolvedQa = resolveSqliteFilePath(databaseUrl, repoRoot);
  if (resolvedQa === productionPath) {
    throw new Error("QA backup path equals production — refused");
  }

  const meta = {
    createdAt: new Date().toISOString(),
    productionPath,
    productionSha256: productionSha,
    qaPath: resolvedQa,
    qaSha256: shaFile(resolvedQa),
    databaseUrl,
    isolated: resolvedQa !== productionPath,
  };
  writeFileSync(path.join(dir, "stage7-final-qa-meta.json"), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify({ ok: true, ...meta }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
