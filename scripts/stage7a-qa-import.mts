#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertStage7aQaDatabase, productionDevDbPath, resolveSqliteFilePath } from "@/lib/stage7a-production-guard";
import { importStage7aContentPackage } from "@/server/stage7a-batch-import";

const cwd = process.cwd();
const qaDefault = path.join(cwd, "prisma", "stage7a-qa.db");
const envUrl = process.env.DATABASE_URL?.trim();
if (!envUrl || envUrl.includes("stage6-qa") || resolveSqliteFilePath(envUrl, cwd).endsWith(`${path.sep}dev.db`)) {
  process.env.DATABASE_URL = `file:${qaDefault.replace(/\\/g, "/")}`;
}

const qaPath = assertStage7aQaDatabase(process.env.DATABASE_URL, cwd);
const productionPath = productionDevDbPath(cwd);
console.log(JSON.stringify({ qaDatabasePath: qaPath, productionDatabasePath: productionPath, same: qaPath === productionPath }, null, 2));
if (qaPath === productionPath) {
  console.error("Refusing Stage 7A import: QA path equals production.");
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(
    path.join(
      cwd,
      process.argv.includes("--v1")
        ? "content/stage7a/stage7a-content-manifest.v1.json"
        : "content/stage7a/stage7a-content-manifest.v2.json",
    ),
    "utf8",
  ),
) as { packages: { file: string; subjectId: string }[] };

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const dryRun = process.argv.includes("--dry-run");

try {
  for (const pkg of manifest.packages) {
    const raw = readFileSync(path.join(cwd, "content/stage7a", pkg.file), "utf8");
    if (dryRun) {
      const { inspectContentPackage } = await import("@/lib/content-package");
      const topics = await prisma.topic.findMany({ where: { subjectId: pkg.subjectId } });
      console.log(JSON.stringify({ dryRun: true, file: pkg.file, topicsInDb: topics.length }, null, 2));
      continue;
    }
    const result = await importStage7aContentPackage(raw, prisma);
    console.log(JSON.stringify({ file: pkg.file, ...result }, null, 2));
    if (!result.ok) process.exit(1);
  }
} finally {
  await prisma.$disconnect();
}
