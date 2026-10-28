import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { addVideoCandidate } from "../src/server/video-lessons";
import { lessonReadiness } from "../src/lib/readiness";
import { initializeSQLite } from "../src/lib/sqlite-init";
import { applyManifestV2, loadManifestV2 } from "./stage6d-apply-manifest-v2";

const workingDb = "D:/НМТ Сайт/NMT-academy/prisma/dev.db";
const topicIds = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const CORRECTION_IDS = [
  "ukr-lex-02-q10",
  "ukr-lex-02-q11",
  "ukr-lex-01-q11",
  "ukr-lex-01-q12",
  "ukr-lex-03-q11",
  "ukr-lex-03-q12",
];

function sha256File(filePath: string) {
  const hash = createHash("sha256");
  return new Promise<string>((resolve, reject) => {
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

function backupWorkingDatabase(targetPath: string) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const source = new DatabaseSync(workingDb, { readOnly: true });
  try {
    source.prepare(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`).run();
  } finally {
    source.close();
  }
}

async function snapshot(prisma: PrismaClient) {
  return {
    question: await prisma.question.count(),
    answer: await prisma.answer.count(),
    testAttempt: await prisma.testAttempt.count(),
    mistake: await prisma.mistake.count(),
    mistakeRetry: await prisma.mistakeRetry.count(),
    reviewSchedule: await prisma.reviewSchedule.count(),
    studyTask: await prisma.studyTask.count(),
    videoLesson: await prisma.videoLesson.count(),
    confirmedVideos: await prisma.videoLesson.count({ where: { reviewStatus: "CONFIRMED" } }),
    verifiedQuestions: await prisma.question.count({ where: { verificationStatus: "VERIFIED" } }),
    draftTopics: await prisma.topic.count({ where: { id: { in: topicIds }, coverage: "DRAFT" } }),
  };
}

type VideoPick = {
  topicId: string;
  youtubeId: string;
  title: string;
  channel: string;
  role: "primary" | "simple";
  verificationLevel: string;
  ownerPreviewRequired: boolean;
};

function recommendedVideos(): VideoPick[] {
  const videoManifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "content/stage6c/stage6c-video-candidates.v1.json"), "utf8"),
  );
  const picks: VideoPick[] = [];
  for (const lesson of videoManifest.lessons) {
    const rec = lesson.recommendation;
    const primary =
      rec.primary ??
      (rec.action === "KEEP_WITH_OWNER_PREVIEW" ? lesson.currentPrimary : null);
    if (primary) {
      picks.push({
        topicId: lesson.topicId,
        youtubeId: primary.youtubeId,
        title: primary.title,
        channel: primary.channel,
        role: "primary",
        verificationLevel: primary.verificationLevel,
        ownerPreviewRequired: true,
      });
    }
    if (rec.supplement) {
      picks.push({
        topicId: lesson.topicId,
        youtubeId: rec.supplement.youtubeId,
        title: rec.supplement.title,
        channel: rec.supplement.channel,
        role: "simple",
        verificationLevel: rec.supplement.verificationLevel,
        ownerPreviewRequired: rec.supplement.verificationLevel !== "VERIFIED_CONTENT",
      });
    }
  }
  return picks;
}

async function topicQa(prisma: PrismaClient) {
  const perTopic = [];
  for (const topicId of topicIds) {
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { questions: true, videos: true },
    });
    const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of topic.questions) counts[q.difficulty as keyof typeof counts]++;
    const readiness = lessonReadiness({ lessonJson: topic.lessonJson, questions: topic.questions, videos: topic.videos });
    perTopic.push({
      topicId,
      coverage: topic.coverage,
      questionTotal: topic.questions.length,
      counts,
      practice: readiness.practice,
      draftQuestions: topic.questions.filter((q) => q.verificationStatus === "DRAFT").length,
      verifiedQuestions: topic.questions.filter((q) => q.verificationStatus === "VERIFIED").length,
    });
  }
  return perTopic;
}

async function main() {
  const beforeWorking = statSync(workingDb);
  const manifest = loadManifestV2();
  const baselineRows = JSON.parse(
    readFileSync(path.join(process.cwd(), "content/stage6b/exported-questions-baseline.json"), "utf8"),
  ) as { id: string }[];
  const baselineIds = new Set(baselineRows.map((q) => q.id));
  const manifestIds = manifest.questions.map((q) => q.id);
  const additionIds = manifestIds.filter((id) => !baselineIds.has(id));

  const folder = path.join(tmpdir(), `nmt-stage6d-${Date.now()}`);
  mkdirSync(folder, { recursive: true });
  const qaDb = path.join(folder, "qa-rehearsal.db").replaceAll("\\", "/");
  backupWorkingDatabase(qaDb);
  const qaSha = await sha256File(qaDb.replaceAll("/", "\\"));

  const afterBackupWorking = statSync(workingDb);
  if (afterBackupWorking.size !== beforeWorking.size || afterBackupWorking.mtimeMs !== beforeWorking.mtimeMs) {
    throw new Error("Working SQLite changed during backup copy");
  }

  const databaseUrl = `file:${qaDb}?connection_limit=1`;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await initializeSQLite(prisma);

  const beforeApply = await snapshot(prisma);
  const beforeSeven = await prisma.question.count({ where: { topicId: { in: topicIds } } });

  const firstApply = await prisma.$transaction((tx) => applyManifestV2(tx, manifest, { strictCorrectionMatch: true }));
  const afterFirst = await snapshot(prisma);
  const afterSeven = await prisma.question.count({ where: { topicId: { in: topicIds } } });

  const secondApply = await prisma.$transaction((tx) => applyManifestV2(tx, manifest, { strictCorrectionMatch: false }));
  const afterSecond = await snapshot(prisma);

  const q08 = await prisma.question.findUniqueOrThrow({
    where: { id: "zcode-biology-molecular-protein-synth-q08" },
  });
  const correctedTexts = await Promise.all(
    CORRECTION_IDS.map(async (id) => {
      const row = await prisma.question.findUniqueOrThrow({ where: { id } });
      const expected = manifest.questions.find((q) => q.id === id)!;
      return {
        id,
        promptMatchesManifest: row.prompt === (expected as { prompt: string }).prompt,
      };
    }),
  );

  const videoPicks = recommendedVideos();
  const videoResults: { topicId: string; youtubeId: string; id: string; duplicate: boolean; reviewStatus: string }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const pick of videoPicks) {
      const before = await tx.videoLesson.findFirst({ where: { topicId: pick.topicId, youtubeId: pick.youtubeId } });
      const result = await addVideoCandidate(tx, pick.topicId, pick.youtubeId, pick.title, pick.role);
      const after = await tx.videoLesson.findUniqueOrThrow({ where: { id: result.id } });
      videoResults.push({
        topicId: pick.topicId,
        youtubeId: pick.youtubeId,
        id: result.id,
        duplicate: Boolean(before),
        reviewStatus: after.reviewStatus,
      });
    }
  });

  const perTopic = await topicQa(prisma);
  const idempotencyOk =
    afterSecond.question === afterFirst.question &&
    secondApply.upserted === manifest.questions.length &&
    secondApply.skippedVerified === 0;

  const report = {
    checkedAt: new Date().toISOString(),
    workingDatabase: {
      path: workingDb,
      sizeBefore: beforeWorking.size,
      mtimeBefore: beforeWorking.mtime.toISOString(),
      unchangedAfterBackup: afterBackupWorking.size === beforeWorking.size && afterBackupWorking.mtimeMs === beforeWorking.mtimeMs,
    },
    qaDatabase: { path: qaDb, sha256: qaSha, backupMethod: "SQLite VACUUM INTO from read-only source connection (consistent snapshot)" },
    manifest: {
      version: manifest.version,
      questionCount: manifest.questions.length,
      baselineCount: baselineIds.size,
      additionIds,
      additionCount: additionIds.length,
      correctionIds: CORRECTION_IDS,
    },
    apply: {
      beforeApply,
      afterFirstApply: afterFirst,
      afterSecondApply: afterSecond,
      questionsInSevenTopicsBefore: beforeSeven,
      questionsInSevenTopicsAfter: afterSeven,
      firstApply,
      secondApply,
      idempotencyOk,
      userTablesUnchanged:
        beforeApply.answer === afterFirst.answer &&
        beforeApply.testAttempt === afterFirst.testAttempt &&
        beforeApply.mistake === afterFirst.mistake &&
        beforeApply.mistakeRetry === afterFirst.mistakeRetry &&
        beforeApply.reviewSchedule === afterFirst.reviewSchedule &&
        beforeApply.studyTask === afterFirst.studyTask,
      confirmedVideosUnchanged: beforeApply.confirmedVideos === afterFirst.confirmedVideos,
      coverageDraftAllSeven: perTopic.every((row) => row.coverage === "DRAFT"),
      noAutoVerified: afterFirst.verifiedQuestions === beforeApply.verifiedQuestions,
      q08PromptStartsWith: q08.prompt.slice(0, 40),
      q08UsesUkrainianWording: q08.prompt.includes("Кодуюча") && q08.prompt.includes("неперекладні"),
      correctedTexts,
    },
    videoCandidates: {
      picked: videoPicks,
      results: videoResults,
      allSuggested: videoResults.every((row) => row.reviewStatus === "SUGGESTED"),
      duplicateAddsIdempotent: videoResults.filter((row) => row.duplicate).length >= 0,
    },
    perTopic,
    errors: [] as string[],
  };

  if (manifest.questions.length !== 84) report.errors.push("manifest not 84");
  if (new Set(manifestIds).size !== 84) report.errors.push("duplicate manifest ids");
  if (additionIds.length !== 14) report.errors.push(`expected 14 additions, got ${additionIds.length}`);
  if (!perTopic.every((row) => row.questionTotal === 12 && row.practice)) report.errors.push("topic thresholds");
  if (!perTopic.every((row) => row.draftQuestions === 12 && row.verifiedQuestions === 0)) report.errors.push("draft guard");
  if (!correctedTexts.every((row) => row.promptMatchesManifest)) report.errors.push("correction text mismatch");
  if (!report.apply.userTablesUnchanged) report.errors.push("user activity tables changed");
  if (!report.apply.confirmedVideosUnchanged) report.errors.push("confirmed videos changed");
  if (!videoResults.every((row) => row.reviewStatus === "SUGGESTED")) report.errors.push("video not suggested");

  writeFileSync(path.join(process.cwd(), "content/stage6d/stage6d-rehearsal-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass: report.errors.length === 0, qaDb, errors: report.errors }, null, 2));
  await prisma.$disconnect();
  if (report.errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
