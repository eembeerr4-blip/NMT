/**
 * Production Stage 7 release: live hash gate + hierarchy + package corrections (single transaction).
 * Requires STAGE7_PRODUCTION_RELEASE=yes and STAGE7B_ACK_PRODUCTION=yes
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { applyContentPlan, reviewedPlan } from "../src/server/content-import-core";
import { STAGE7_PRODUCTION_DB } from "./stage7-final-production-path.mjs";
import { STAGE7B_ALLOWLIST } from "./stage7b-allowlist.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionPath = path.normalize(STAGE7_PRODUCTION_DB);
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7c/stage7c-corrections-manifest.v2.json"), "utf8"),
);
const v2Manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7a/stage7a-content-manifest.v2.json"), "utf8"),
);
const hierarchy = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7c/stage7c-hierarchy-fix.v1.json"), "utf8"),
);
const liveSnapshotPath = process.env.STAGE7_LIVE_HASH_SNAPSHOT;
const liveSnapshot = liveSnapshotPath
  ? JSON.parse(readFileSync(liveSnapshotPath, "utf8"))
  : null;

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

function assertProductionRelease() {
  if (process.env.STAGE7_PRODUCTION_RELEASE !== "yes") {
    throw new Error("Set STAGE7_PRODUCTION_RELEASE=yes");
  }
  if (process.env.STAGE7B_ACK_PRODUCTION !== "yes") {
    throw new Error("Set STAGE7B_ACK_PRODUCTION=yes");
  }
  const url = process.env.DATABASE_URL ?? "";
  const filePart = url.replace(/^file:/, "");
  const resolved = path.normalize(filePart);
  if (resolved !== productionPath) {
    throw new Error(`DATABASE_URL must be production dev.db. Got ${resolved}`);
  }
}

async function verifyHashGate(db: PrismaClient) {
  const conflicts: { questionId?: string; topicId?: string; expected: string; live: string; after?: string }[] = [];
  const skipped: string[] = [];
  const snapByQ = new Map(
    (liveSnapshot?.rows ?? [])
      .filter((r: { targetType: string }) => r.targetType === "question")
      .map((r: { questionId: string; liveContentHash: string }) => [r.questionId, r.liveContentHash]),
  );
  for (const fix of manifest.corrections.filter((c: { targetType: string }) => c.targetType === "question")) {
    const q = await db.question.findUnique({
      where: { id: fix.questionId },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    if (!q) throw new Error(`Missing question ${fix.questionId}`);
    const live = qHashCore({
      prompt: q.prompt,
      correctAnswer: q.correctAnswer,
      options: q.options.map((o) => ({ label: o.label, text: o.text })),
    });
    if (fix.contentHashAfter && live === fix.contentHashAfter) {
      skipped.push(fix.questionId);
      continue;
    }
    const expectedBefore =
      snapByQ.get(fix.questionId) ?? fix.contentHashBefore;
    if (expectedBefore && live !== expectedBefore) {
      conflicts.push({
        questionId: fix.questionId,
        expected: expectedBefore,
        live,
        after: fix.contentHashAfter,
      });
    }
  }
  if (conflicts.length) {
    throw new Error(`Hash gate failed: ${JSON.stringify(conflicts.slice(0, 5))}${conflicts.length > 5 ? "…" : ""}`);
  }
  if (!liveSnapshot) {
    throw new Error("STAGE7_LIVE_HASH_SNAPSHOT required for production apply");
  }
  return { skipped, checked: manifest.corrections.filter((c: { targetType: string }) => c.targetType === "question").length };
}

async function main() {
  assertProductionRelease();
  const databaseUrl = process.env.DATABASE_URL!;
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const gate = await verifyHashGate(prisma);
    await prisma.$transaction(
      async (tx) => {
        for (const op of hierarchy.operations) {
          if (op.type !== "reparent") continue;
          for (const childId of op.childIds) {
            const child = await tx.topic.findUnique({ where: { id: childId } });
            if (!child) throw new Error(`Missing child ${childId}`);
            if (child.parentId === op.newParentId) continue;
            if (child.parentId !== op.fromParentId) {
              throw new Error(`Hierarchy conflict ${childId}: parent=${child.parentId}`);
            }
            await tx.topic.update({ where: { id: childId }, data: { parentId: op.newParentId } });
          }
        }
        for (const pkg of v2Manifest.packages) {
          const raw = readFileSync(path.join(repoRoot, "content/stage7a", pkg.file), "utf8");
          const reviewed = await reviewedPlan(raw, tx);
          if (!reviewed.plan) throw new Error(reviewed.error || "plan failed");
          await applyContentPlan(tx, reviewed.plan);
        }
      },
      { maxWait: 30000, timeout: 180000 },
    );

    for (const topicId of STAGE7B_ALLOWLIST) {
      const t = await prisma.topic.findUnique({
        where: { id: topicId },
        include: { questions: true, children: { select: { id: true } } },
      });
      if (!t || t.coverage !== "DRAFT") throw new Error(`${topicId} coverage=${t?.coverage}`);
      if (t.questions.length !== 12) throw new Error(`${topicId} questions=${t.questions.length}`);
      if (t.children.length) throw new Error(`${topicId} still has ${t.children.length} children`);
    }

    console.log(JSON.stringify({ ok: true, hashGate: gate }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
