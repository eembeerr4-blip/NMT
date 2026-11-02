/**
 * Stage 6F.1 — read-only audit of working DB + HTML contentHash alignment.
 * npx --prefix "D:/НМТ Сайт/NMT-academy" tsx scripts/stage6f1-readiness-audit.ts
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { lessonReadiness, lessonAccess } from "../src/lib/readiness";
import { parseLesson } from "../src/lib/lesson";

const WORKING_DB = "D:/НМТ Сайт/NMT-academy/prisma/dev.db".replaceAll("\\", "/");
const STAGE6B_HTML = "D:/НМТ Сайт/NMT-stage6b-questions/content/stage6b/stage6b2-owner-review.html";
const STAGE6C = "D:/НМТ Сайт/NMT-stage6c-videos/content/stage6c/stage6c-video-candidates.v1.json";

const topicIds = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const RECOMMENDED: { topicId: string; youtubeId: string }[] = [
  { topicId: "ukr-lex-01-meaning", youtubeId: "NDmd6xU9F2E" },
  { topicId: "ukr-lex-02-syn-ant-hom", youtubeId: "scigg_eN4qs" },
  { topicId: "ukr-lex-02-syn-ant-hom", youtubeId: "o9xcL5pCxog" },
  { topicId: "ukr-lex-03-phraseology", youtubeId: "wm0X68H_WtQ" },
  { topicId: "ukr-lex-03-phraseology", youtubeId: "oZfA9V0mhV4" },
  { topicId: "bio-cell-01-eukaryotic-cell", youtubeId: "bBymW0PtVT0" },
  { topicId: "bio-cell-01-eukaryotic-cell", youtubeId: "jCVunU5VGbI" },
  { topicId: "zcode-biology-molecular-dna-rna", youtubeId: "G63P4uoP6Fs" },
  { topicId: "zcode-biology-molecular-dna-rna", youtubeId: "K541lnwQmTQ" },
  { topicId: "zcode-biology-molecular-protein-synth", youtubeId: "vs6GLwIxI-U" },
  { topicId: "zcode-biology-molecular-protein-synth", youtubeId: "UGE4mfJliqo" },
  { topicId: "zcode-biology-molecular-division", youtubeId: "19a17ENs64g" },
  { topicId: "zcode-biology-molecular-division", youtubeId: "RV-aJuuOHrE" },
];

function contentHash(question: {
  prompt: string;
  explanation: string;
  correctAnswer: string;
  options: { label: string; text: string; matchKey: string | null }[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prompt: question.prompt,
        explanation: question.explanation,
        correctAnswer: question.correctAnswer,
        options: question.options.map((o) => ({ label: o.label, text: o.text, matchKey: o.matchKey ?? null })),
      }),
    )
    .digest("hex");
}

function loadHtmlPacket() {
  const html = readFileSync(STAGE6B_HTML, "utf8");
  const m = html.match(/<script id="packet" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("packet JSON not found in stage6b2-owner-review.html");
  const parsed = JSON.parse(m[1]) as {
    questions: Array<{
      id: string;
      contentHash: string;
      prompt: string;
      correctAnswer: string;
      explanation: string;
      options: { label: string; text: string; matchKey: string | null }[];
    }>;
  };
  const byId = Object.fromEntries(parsed.questions.map((q) => [q.id, q]));
  return { byId, count: parsed.questions.length };
}

function countAnswerChecks(topics: { lessonJson: string | null }[]) {
  let n = 0;
  for (const t of topics) {
    try {
      const lesson = JSON.parse(t.lessonJson || "{}") as { examples?: { answerCheck?: unknown }[] };
      for (const ex of lesson.examples ?? []) if (ex.answerCheck) n++;
    } catch {
      /* ignore */
    }
  }
  return n;
}

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${WORKING_DB}?connection_limit=1` } },
  });

  const integrity = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  const fk = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  const migrations = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at',
  );

  const packet = loadHtmlPacket();
  const hashMismatches: { id: string; db: string; html: string }[] = [];
  const missingInHtml: string[] = [];
  const missingInDb: string[] = [];

  for (const topicId of topicIds) {
    const qs = await prisma.question.findMany({
      where: { topicId },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    for (const q of qs) {
      const htmlQ = packet.byId[q.id];
      if (!htmlQ) {
        missingInHtml.push(q.id);
        continue;
      }
      const dbHash = contentHash({
        prompt: q.prompt,
        explanation: q.explanation,
        correctAnswer: q.correctAnswer,
        options: q.options.map((o) => ({ label: o.label, text: o.text, matchKey: o.matchKey })),
      });
      if (dbHash !== htmlQ.contentHash) hashMismatches.push({ id: q.id, db: dbHash, html: htmlQ.contentHash });
    }
  }
  for (const id of Object.keys(packet.byId)) {
    if (!topicIds.some((tid) => id.startsWith(tid))) continue;
    const exists = await prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (!exists) missingInDb.push(id);
  }

  const verifiedSeven = await prisma.question.count({
    where: { topicId: { in: topicIds }, verificationStatus: "VERIFIED" },
  });
  const draftSeven = await prisma.question.count({
    where: { topicId: { in: topicIds }, verificationStatus: "DRAFT" },
  });

  const videoTotal = await prisma.videoLesson.count({
    where: { topicId: { in: topicIds } },
  });
  const videoGlobal = await prisma.videoLesson.count();

  const recommendedStatus: Record<string, unknown>[] = [];
  for (const pair of RECOMMENDED) {
    const row = await prisma.videoLesson.findFirst({
      where: { topicId: pair.topicId, youtubeId: pair.youtubeId },
    });
    recommendedStatus.push({
      ...pair,
      found: Boolean(row),
      reviewStatus: row?.reviewStatus ?? null,
      isPrimary: row?.isPrimary ?? null,
      id: row?.id ?? null,
    });
  }

  const stage6c = JSON.parse(readFileSync(STAGE6C, "utf8"));
  const editorialRows = [];
  for (const topicId of topicIds) {
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { questions: true, videos: { orderBy: { createdAt: "asc" } } },
    });
    const lesson = parseLesson(topic.lessonJson);
    const readiness = lessonReadiness(topic);
    const access = lessonAccess(topic);
    const cLesson = stage6c.lessons.find((l: { topicId: string }) => l.topicId === topicId);
    const rec = cLesson?.recommendation;
    const primaryYt =
      rec?.primary?.youtubeId ??
      (rec?.action === "KEEP_WITH_OWNER_PREVIEW" ? cLesson?.currentPrimary?.youtubeId : null);
    const supplementYt = rec?.supplement?.youtubeId ?? null;
    const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of topic.questions) counts[q.difficulty as keyof typeof counts]++;
    editorialRows.push({
      topicId,
      title: topic.title,
      coverage: topic.coverage,
      lessonSummary: lesson?.summary?.slice(0, 120) ?? "",
      theoryChars: lesson?.theory?.length ?? 0,
      questionTotal: topic.questions.length,
      counts,
      draftQuestions: topic.questions.filter((q) => q.verificationStatus === "DRAFT").length,
      verifiedQuestions: topic.questions.filter((q) => q.verificationStatus === "VERIFIED").length,
      videosInTopic: topic.videos.map((v) => ({
        youtubeId: v.youtubeId,
        reviewStatus: v.reviewStatus,
        isPrimary: v.isPrimary,
        role: v.role,
      })),
      proposedPrimaryYoutubeId: primaryYt,
      proposedSupplementYoutubeId: supplementYt,
      primaryVerificationLevel: rec?.primary?.verificationLevel ?? cLesson?.currentPrimary?.verificationLevel ?? null,
      supplementVerificationLevel: rec?.supplement?.verificationLevel ?? null,
      technicalReadiness: readiness,
      learnerAccess: access,
      publishReady: readiness.ready && topic.coverage !== "DRAFT",
    });
  }

  const allTopics = await prisma.topic.findMany({ select: { lessonJson: true } });
  const answerCheck = countAnswerChecks(allTopics);
  const studyTask = await prisma.studyTask.count();

  const report = {
    checkedAt: new Date().toISOString(),
    workingDatabasePath: WORKING_DB,
    integrity: integrity[0]?.integrity_check,
    fkCount: Array.isArray(fk) ? fk.length : -1,
    migrationCount: migrations.length,
    migrations: migrations.map((m) => m.migration_name),
    questionsSevenTopics: draftSeven + verifiedSeven,
    draftSeven,
    verifiedSeven,
    videoInSevenTopics: videoTotal,
    videoGlobal,
    answerCheck,
    studyTask,
    htmlAlignment: {
      htmlQuestionCount: packet.count,
      hashMismatches,
      missingInHtml,
      missingInDb,
      aligned: hashMismatches.length === 0 && missingInDb.length === 0 && missingInHtml.length === 0,
    },
    recommendedVideos: recommendedStatus,
    editorialRows,
    approvalProcedureNotes: {
      verifyQuestion: "EDITOR+ only; VERIFIED runs prepareQuestion validation; does not auto-publish topic",
      setVideoReview: "CONFIRMED|REJECTED; triggers reconcileVideoPrimary among CONFIRMED only",
      makePrimary: "Requires reviewStatus CONFIRMED",
      publishLesson: "Sets coverage READY (from content-import); separate from verifyQuestion",
      lessonReadinessReady: "theory>=600+sections+examples>=2+practice 4/5/3+CONFIRMED video+not section parent",
      lessonAccessForLearner: "DRAFT hides all; needs non-DRAFT coverage for theory/video/practice",
    },
  };

  const outPath = path.join("D:/НМТ Сайт/backups", `stage6f1-audit-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outPath, ...report.htmlAlignment, draftSeven, videoGlobal, answerCheck }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
