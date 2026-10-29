/**
 * QA-only: simulate verifyQuestion for review decisions marked VERIFIED_CANDIDATE.
 * Does NOT call production verifyQuestion API; updates verificationStatus on QA DB only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { assertStage7aQaDatabase } from "../src/lib/stage7a-production-guard";
import { lessonReadiness } from "../src/lib/readiness";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const decisions = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7c/stage7c-review-decisions.v1.json"), "utf8"),
);

const allowlist = new Set([
  "geography-1",
  "geography-2",
  "ukr-lexicology-section-01",
  "ukr-ortho-sub-01",
  "math-linear-eq-sub-02",
  "math-quadratic-sub-01",
  "cm-history-slavs-sub-01",
  "hist-galicia-sub-01",
  "bio-cell-sec-01",
  "zcode-biology-molecular-02",
]);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  assertStage7aQaDatabase(databaseUrl, repoRoot);

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const verifiedIds = decisions.decisions
      .filter((d) => d.reviewStatus === "VERIFIED_CANDIDATE")
      .map((d) => d.questionId);

    await prisma.$transaction(async (tx) => {
      for (const id of verifiedIds) {
        await tx.question.updateMany({
          where: { id, verificationStatus: "DRAFT" },
          data: { verificationStatus: "VERIFIED" },
        });
      }
    });

    const readiness = [];
    for (const topicId of allowlist) {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: { questions: true, videos: true, children: { select: { id: true } } },
      });
      if (!topic) continue;
      readiness.push({
        topicId,
        coverage: topic.coverage,
        readiness: lessonReadiness(topic),
      });
    }

    console.log(
      JSON.stringify(
        {
          simulatedVerified: verifiedIds.length,
          readiness,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
