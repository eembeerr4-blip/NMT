import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const root = process.cwd();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(root, "..", "backups", `stage5b-final-${stamp}`);
  const target = path.join(backupDir, "dev.db").replaceAll("\\", "/");

  mkdirSync(backupDir, { recursive: true });
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(FULL)");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  await prisma.$disconnect();

  const verify = new PrismaClient({ datasources: { db: { url: `file:${target}?connection_limit=1` } } });
  const integrity = await verify.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  const fk = await verify.$queryRawUnsafe("PRAGMA foreign_key_check");
  const tables = await verify.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  await verify.$disconnect();

  const winPath = target.replaceAll("/", "\\");
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    createReadStream(winPath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve())
      .on("error", reject);
  });
  const sha256 = hash.digest("hex");
  const manifest = {
    createdAt: new Date().toISOString(),
    source: path.join(root, "prisma", "dev.db"),
    target: winPath,
    sha256,
    integrity,
    fkCount: Array.isArray(fk) ? fk.length : 0,
    tableCount: tables.length,
    tableNames: tables.map((t) => t.name),
  };
  writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ backupDir, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
