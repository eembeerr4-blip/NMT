import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { lessonReadiness, lessonAccess, publishReadinessError } from "../src/lib/readiness";

const WORKING = path.join(process.cwd(), "prisma", "dev.db");
const QA_DIR = path.join(process.cwd(), "..", "backups", "stage6-text-only-qa");
const QA_DB = path.join(QA_DIR, "dev.db");

const topics = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

async function hashFile(file: string) {
  const { readFileSync } = await import("node:fs");
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

async function main() {
  mkdirSync(QA_DIR, { recursive: true });
  copyFileSync(WORKING, QA_DB);
  const workingSha = await hashFile(WORKING);
  const qaSha = await hashFile(QA_DB);

  const p = new PrismaClient({
    datasources: { db: { url: `file:${QA_DB.replaceAll("\\", "/")}?connection_limit=1` } },
  });

  const integrity = (await p.$queryRawUnsafe("PRAGMA integrity_check")) as { integrity_check: string }[];
  const fk = (await p.$queryRawUnsafe("PRAGMA foreign_key_check") as unknown[]).length;
  const verified = await p.question.count({
    where: { topicId: { in: topics }, verificationStatus: "VERIFIED" },
  });

  const perTopic = [];
  for (const topicId of topics) {
    const topic = await p.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        questions: { where: { verificationStatus: "VERIFIED" }, select: { difficulty: true, verificationStatus: true } },
        videos: { select: { reviewStatus: true, isPrimary: true, youtubeId: true } },
        children: { select: { id: true } },
      },
    });
    const readiness = lessonReadiness({ ...topic, questions: topic.questions });
    const learnerDraft = lessonAccess({ ...topic, coverage: "DRAFT", questions: topic.questions });
    const learnerReady = lessonAccess({ ...topic, coverage: "READY", questions: topic.questions });
    perTopic.push({
      topicId,
      coverage: topic.coverage,
      ready: readiness.ready,
      publishError: publishReadinessError(readiness),
      learnerWhileDraft: learnerDraft.available,
      wouldShowVideoIfPublished: learnerReady.video,
      confirmedCount: topic.videos.filter((v) => v.reviewStatus === "CONFIRMED").length,
    });
  }

  console.log(
    JSON.stringify(
      {
        workingDbSha256: workingSha,
        qaCopySha256: qaSha,
        shaMatch: workingSha === qaSha,
        integrity: integrity[0]?.integrity_check,
        fk,
        verifiedInSevenTopics: verified,
        allSevenPublishReady: perTopic.every((row) => row.ready && row.publishError === null),
        perTopic,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
}

main();
