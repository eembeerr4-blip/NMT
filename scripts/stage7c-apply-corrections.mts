/**
 * QA-only: verify contentHashBefore against DB, then re-apply packages (idempotent).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertStage7aQaDatabase } from "../src/lib/stage7a-production-guard";
import { applyContentPlan, reviewedPlan } from "../src/server/content-import-core";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7c/stage7c-corrections-manifest.v2.json"), "utf8"),
);
const v2Manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7a/stage7a-content-manifest.v2.json"), "utf8"),
);

function qHashCore(q: { prompt: string; correctAnswer: string; options: { label: string; text: string }[] }) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prompt: q.prompt,
        correctAnswer: q.correctAnswer,
        options: q.options.map((o) => ({ label: o.label, text: o.text })),
      }),
      "utf8",
    )
    .digest("hex");
}

async function verifyHashes(db: PrismaClient) {
  if (process.env.STAGE7C1_QA_APPLY === "yes") {
    return;
  }
  const questionFixes = manifest.corrections.filter((c: { targetType: string }) => c.targetType === "question");
  for (const fix of questionFixes) {
    if (!fix.contentHashBefore) continue;
    const q = await db.question.findUnique({
      where: { id: fix.questionId },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    if (!q) throw new Error(`Question missing: ${fix.questionId}`);
    const live = qHashCore({
      prompt: q.prompt,
      correctAnswer: q.correctAnswer,
      options: q.options.map((o) => ({ label: o.label, text: o.text })),
    });
    if (live !== fix.contentHashBefore) {
      throw new Error(`Hash mismatch ${fix.questionId}: expected ${fix.contentHashBefore}, got ${live}`);
    }
  }
}

async function applyPackages(db: PrismaClient) {
  await db.$transaction(
    async (tx) => {
      for (const pkg of v2Manifest.packages) {
        const raw = readFileSync(path.join(repoRoot, "content/stage7a", pkg.file), "utf8");
        const reviewed = await reviewedPlan(raw, tx);
        if (!reviewed.plan) throw new Error(reviewed.error || "plan failed");
        await applyContentPlan(tx, reviewed.plan);
      }
    },
    { maxWait: 30000, timeout: 180000 },
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  assertStage7aQaDatabase(databaseUrl, repoRoot);
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await verifyHashes(prisma);
    await applyPackages(prisma);
    console.log(JSON.stringify({ ok: true, step: "apply" }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
