import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) throw new Error("SOURCE_DATABASE_URL required");
  const outDir = process.env.STAGE6A_BACKUP_DIR;
  if (!outDir) throw new Error("STAGE6A_BACKUP_DIR required");

  mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, "dev.db").replaceAll("\\", "/");

  const prisma = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(FULL)");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  await prisma.$disconnect();

  const verify = new PrismaClient({
    datasources: { db: { url: `file:${target}?connection_limit=1` } },
  });
  const integrity = await verify.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  await verify.$disconnect();

  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    createReadStream(target.replaceAll("/", "\\"))
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve())
      .on("error", reject);
  });

  const manifest = {
    createdAt: new Date().toISOString(),
    method: "PRAGMA wal_checkpoint(FULL) + VACUUM INTO (read-only copy; source not overwritten)",
    sourceUrl: sourceUrl.replace(/\/[^/]+$/, "/[redacted].db"),
    target,
    sha256: hash.digest("hex"),
    integrity,
  };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
