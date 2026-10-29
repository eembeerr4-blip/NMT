/**
 * QA-only: re-apply patched packages-v2 to an already-imported DB (idempotent content update).
 * Refuses production dev.db.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { assertStage7aQaDatabase } from "../src/lib/stage7a-production-guard";
import { applyContentPlan, reviewedPlan } from "../src/server/content-import-core";
import { STAGE7B_ALLOWLIST } from "./stage7b-allowlist.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7a/stage7a-content-manifest.v2.json"), "utf8"),
);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const resolved = assertStage7aQaDatabase(databaseUrl, repoRoot);
  console.log(JSON.stringify({ qaPath: resolved }, null, 2));

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const pkg of manifest.packages) {
          const raw = readFileSync(path.join(repoRoot, "content/stage7a", pkg.file), "utf8");
          const reviewed = await reviewedPlan(raw, tx);
          if (!reviewed.plan) throw new Error(reviewed.error || "plan failed");
          await applyContentPlan(tx, reviewed.plan);
        }
      },
      { maxWait: 30000, timeout: 180000 },
    );

    const topics = await prisma.topic.findMany({
      where: { id: { in: STAGE7B_ALLOWLIST } },
      include: { questions: true },
    });
    for (const t of topics) {
      if (t.questions.length !== 12) throw new Error(`${t.id} question count ${t.questions.length}`);
    }
    console.log(JSON.stringify({ ok: true, topics: topics.length }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
