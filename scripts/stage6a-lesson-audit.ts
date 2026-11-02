import { writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { lessonAccess, lessonReadiness } from "../src/lib/readiness";
import { learnerQuestionAvailable, learnerTestAvailable } from "../src/lib/test-access";
import { parseLesson } from "../src/lib/lesson";

const TOPIC_IDS = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

async function main() {
  const prisma = new PrismaClient();
  const outDir = process.env.STAGE6A_OUT_DIR ?? path.join(process.cwd(), "stage6a-audit");
  const topics = await prisma.topic.findMany({
    where: { id: { in: TOPIC_IDS } },
    include: {
      children: { select: { id: true, title: true, sortOrder: true } },
      videos: { orderBy: { isPrimary: "desc" } },
      questions: {
        include: { options: true },
        orderBy: { difficulty: "asc" },
      },
      tests: { include: { questions: { include: { question: { include: { topic: true } } } } } },
      tasks: true,
      dependsOn: { include: { prerequisite: { select: { id: true, title: true, coverage: true } } } },
      subject: { select: { id: true, name: true } },
    },
  });

  const order = new Map(TOPIC_IDS.map((id, i) => [id, i]));
  topics.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const missing = TOPIC_IDS.filter((id) => !topics.some((t) => t.id === id));

  const globalVideos = await prisma.videoLesson.findMany({
    where: { topicId: { in: TOPIC_IDS } },
    include: { topic: { select: { id: true, title: true } } },
    orderBy: [{ topicId: "asc" }, { isPrimary: "desc" }],
  });

  const report = {
    generatedAt: new Date().toISOString(),
    topicIds: TOPIC_IDS,
    missingTopicRows: missing,
    lessons: topics.map((topic) => {
      const lesson = parseLesson(topic.lessonJson);
      const access = lessonAccess({
        lessonJson: topic.lessonJson,
        coverage: topic.coverage,
        questions: topic.questions,
        videos: topic.videos,
      });
      const readiness = lessonReadiness({
        lessonJson: topic.lessonJson,
        children: topic.children,
        questions: topic.questions,
        videos: topic.videos,
      });

      const qByDiff = { EASY: 0, MEDIUM: 0, HARD: 0, OTHER: 0 };
      const qByVer = { VERIFIED: 0, DRAFT: 0, OTHER: 0 };
      let learnerAvailableCount = 0;
      let missingCorrect = 0;
      let missingOptions = 0;

      for (const q of topic.questions) {
        if (q.difficulty in qByDiff) qByDiff[q.difficulty as keyof typeof qByDiff]++;
        else qByDiff.OTHER++;
        if (q.verificationStatus === "VERIFIED") qByVer.VERIFIED++;
        else if (q.verificationStatus === "DRAFT") qByVer.DRAFT++;
        else qByVer.OTHER++;
        if (learnerQuestionAvailable(q)) learnerAvailableCount++;
        if (!q.correctAnswer?.trim()) missingCorrect++;
        if (q.type !== "SHORT_TEXT" && q.type !== "STEP_BY_STEP" && q.options.length === 0) missingOptions++;
      }

      const testsSummary = topic.tests.map((t) => ({
        id: t.id,
        title: t.title,
        questionCount: t.questions.length,
        learnerAvailable: learnerTestAvailable(t),
      }));

      const studyTasks = topic.tasks.length;

      return {
        id: topic.id,
        title: topic.title,
        subject: topic.subject,
        coverage: topic.coverage,
        lessonJsonBytes: topic.lessonJson.length,
        lessonParseOk: Boolean(lesson),
        theoryChars: lesson?.theory.trim().length ?? 0,
        objectives: lesson?.objectives.length ?? 0,
        rules: lesson?.rules.length ?? 0,
        mistakes: lesson?.mistakes.length ?? 0,
        examples: lesson?.examples.length ?? 0,
        summaryChars: lesson?.summary.trim().length ?? 0,
        hasFormulasField: Boolean(topic.formulas.trim()),
        formulasFieldChars: topic.formulas.length,
        theorySnippet: lesson?.theory.trim().slice(0, 200) ?? "",
        childrenCount: topic.children.length,
        childIds: topic.children.map((c) => c.id),
        prerequisites: topic.dependsOn.map((d) => ({
          id: d.prerequisite.id,
          title: d.prerequisite.title,
          coverage: d.prerequisite.coverage,
        })),
        access,
        readiness,
        questions: {
          total: topic.questions.length,
          byDifficulty: qByDiff,
          byVerification: qByVer,
          learnerAvailableCount,
          missingCorrect,
          missingOptions,
        },
        tests: testsSummary,
        studyTasks,
        videos: topic.videos.map((v) => ({
          id: v.id,
          title: v.title,
          youtubeId: v.youtubeId,
          url: v.url,
          reviewStatus: v.reviewStatus,
          durationSec: v.durationSec,
          isPrimary: v.isPrimary,
          role: v.role,
          channel: v.channel,
        })),
      };
    }),
    allVideos: globalVideos.map((v) => ({
      topicId: v.topicId,
      topicTitle: v.topic.title,
      title: v.title,
      url: v.url,
      youtubeId: v.youtubeId,
      durationSec: v.durationSec,
      reviewStatus: v.reviewStatus,
      isPrimary: v.isPrimary,
      channel: v.channel,
    })),
    aggregates: {
      videoReviewStatus: globalVideos.reduce(
        (acc, v) => {
          acc[v.reviewStatus] = (acc[v.reviewStatus] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      draftTopics: topics.filter((t) => t.coverage === "DRAFT").length,
    },
  };

  writeFileSync(path.join(outDir, "stage6a-db-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outDir, lessons: report.lessons.length, videos: report.allVideos.length }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
