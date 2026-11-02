/**
 * Snapshot live content hashes for Stage 7 correction targets (production pre-apply).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { STAGE7_PRODUCTION_DB } from "./stage7-final-production-path.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7c/stage7c-corrections-manifest.v2.json"), "utf8"),
);
const outPath = process.argv[2];
if (!outPath) {
  console.error("Usage: node stage7-production-snapshot-hashes.mjs <output.json>");
  process.exit(1);
}

function qHashCore(q) {
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

function lessonHash(lessonJson) {
  return createHash("sha256").update(lessonJson ?? "", "utf8").digest("hex");
}

async function main() {
  const url = `file:${STAGE7_PRODUCTION_DB.replace(/\\/g, "/")}`;
  const prisma = new PrismaClient({ datasourceUrl: url });
  const rows = [];
  try {
    for (const fix of manifest.corrections) {
      if (fix.targetType === "question") {
        const q = await prisma.question.findUnique({
          where: { id: fix.questionId },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        });
        if (!q) throw new Error(`Missing ${fix.questionId}`);
        rows.push({
          targetType: "question",
          questionId: fix.questionId,
          topicId: fix.topicId,
          liveContentHash: qHashCore(q),
          manifestBefore: fix.contentHashBefore,
          manifestAfter: fix.contentHashAfter,
        });
      } else if (fix.targetType === "topic") {
        const t = await prisma.topic.findUnique({ where: { id: fix.topicId } });
        if (!t) throw new Error(`Missing topic ${fix.topicId}`);
        rows.push({
          targetType: "topic",
          topicId: fix.topicId,
          liveContentHash: lessonHash(t.lessonJson),
          manifestBefore: fix.contentHashBefore,
          manifestAfter: fix.contentHashAfter,
        });
      }
    }
    writeFileSync(outPath, JSON.stringify({ capturedAt: new Date().toISOString(), dbPath: STAGE7_PRODUCTION_DB, rows }, null, 2));
    console.log(JSON.stringify({ ok: true, count: rows.length, outPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
