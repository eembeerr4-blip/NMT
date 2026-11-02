/**
 * QA-only batch: mirrors verifyQuestion + publishLesson server logic (see actions.ts / content-import.ts).
 * Requires STAGE7_FINAL_QA_BATCH=yes and non-production DATABASE_URL.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { resolveSqliteFilePath } from "../src/lib/stage7a-production-guard";
import { prepareQuestion } from "../src/lib/question-input";
import { lessonReadiness, publishReadinessError } from "../src/lib/readiness";
import { STAGE7_PRODUCTION_DB } from "./stage7-final-production-path.mjs";
import { STAGE7B_ALLOWLIST } from "./stage7b-allowlist.mjs";
import { recordAudit } from "../src/server/audit-log";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionPath = path.normalize(STAGE7_PRODUCTION_DB);

async function main() {
  if (process.env.STAGE7_FINAL_QA_BATCH !== "yes") {
    throw new Error("Set STAGE7_FINAL_QA_BATCH=yes");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const qaPath = resolveSqliteFilePath(databaseUrl, repoRoot);
  if (qaPath === productionPath) throw new Error("Refused: production DATABASE_URL");

  const decisions = JSON.parse(
    readFileSync(path.join(repoRoot, "content/stage7c/stage7c-review-decisions.v2.json"), "utf8"),
  );
  const verifiedIds = decisions.decisions
    .filter((d: { reviewStatus: string }) => d.reviewStatus === "VERIFIED_CANDIDATE")
    .map((d: { questionId: string }) => d.questionId);
  if (verifiedIds.length !== 120) throw new Error(`Expected 120 decisions, got ${verifiedIds.length}`);

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const owner = await prisma.user.findUnique({ where: { id: "owner" } });
    if (!owner) throw new Error("No owner user (id=owner) in QA DB for audit trail");

    const verifyStatus = z.enum(["VERIFIED", "DRAFT", "REJECTED"]);
    let verifiedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const id of verifiedIds) {
        verifyStatus.parse("VERIFIED");
        const question = await tx.question.findUniqueOrThrow({
          where: { id },
          include: { options: true },
        });
        if (!question.topicId || !STAGE7B_ALLOWLIST.includes(question.topicId)) {
          throw new Error(`Question ${id} outside allowlist`);
        }
        prepareQuestion(question);
        await tx.question.update({ where: { id }, data: { verificationStatus: "VERIFIED" } });
        verifiedCount++;
      }
    });

    const publishResults: { topicId: string; ok: boolean; error?: string }[] = [];
    for (const topicId of STAGE7B_ALLOWLIST) {
      const result = await prisma.$transaction(async (tx) => {
        const topic = await tx.topic.findUnique({
          where: { id: topicId },
          include: { questions: true, videos: true, children: { select: { id: true } } },
        });
        if (!topic) return { ok: false as const, error: "Тему не знайдено." };
        if (topic.coverage === "READY" || topic.coverage === "VERIFIED") {
          return { ok: true as const, message: "already published" };
        }
        const readiness = lessonReadiness(topic);
        const blocked = publishReadinessError(readiness);
        if (blocked) return { ok: false as const, error: blocked };
        await tx.topic.update({ where: { id: topicId }, data: { coverage: "READY" } });
        await recordAudit(
          owner,
          { action: "LESSON_PUBLISHED", entityType: "topic", entityId: topicId },
          tx,
        );
        return { ok: true as const };
      });
      publishResults.push({ topicId, ok: result.ok, error: "error" in result ? result.error : undefined });
    }

    const published = publishResults.filter((r) => r.ok).length;
    const allVerified = await prisma.question.count({
      where: { id: { in: verifiedIds }, verificationStatus: "VERIFIED" },
    });

    console.log(
      JSON.stringify(
        {
          ok: publishResults.every((r) => r.ok),
          verifiedQuestions: allVerified,
          publishedTopics: published,
          publishResults,
        },
        null,
        2,
      ),
    );
    if (!publishResults.every((r) => r.ok)) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
