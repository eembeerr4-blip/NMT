import { writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const IDS = [
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
  const allV = (await prisma.videoLesson.groupBy({ by: ["reviewStatus"], _count: true })).map((row) => ({
    reviewStatus: row.reviewStatus,
    count: Number(row._count),
  }));
  const confirmed = await prisma.videoLesson.findMany({
    where: { reviewStatus: "CONFIRMED" },
    select: { id: true, topicId: true, title: true, youtubeId: true, url: true },
  });
  const suggestedNotIn7 = await prisma.videoLesson.findMany({
    where: { reviewStatus: "SUGGESTED", topicId: { notIn: IDS } },
    select: { topicId: true, title: true, youtubeId: true },
  });
  const studyTasks = await prisma.studyTask.findMany({
    where: { topicId: { in: IDS } },
    select: { id: true, topicId: true, title: true, kind: true },
  });
  const badOpts = await prisma.question.findMany({
    where: {
      topicId: { in: IDS },
      type: { notIn: ["SHORT_TEXT", "STEP_BY_STEP"] },
    },
    include: { options: true },
  });
  const missing = badOpts
    .filter((q) => q.options.length === 0)
    .map((q) => ({ id: q.id, topicId: q.topicId, type: q.type, difficulty: q.difficulty, prompt: q.prompt.slice(0, 120) }));

  const siblingNav = await Promise.all(
    IDS.map(async (id) => {
      const topic = await prisma.topic.findUnique({ where: { id }, select: { id: true, subjectId: true, parentId: true, sortOrder: true, title: true } });
      if (!topic) return { id, error: "missing" };
      const siblings = await prisma.topic.findMany({
        where: { subjectId: topic.subjectId, parentId: topic.parentId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, sortOrder: true, coverage: true },
      });
      const idx = siblings.findIndex((s) => s.id === id);
      return {
        id,
        title: topic.title,
        subjectId: topic.subjectId,
        sortOrder: topic.sortOrder,
        prev: idx > 0 ? siblings[idx - 1] : null,
        next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
        siblingDraftCount: siblings.filter((s) => s.coverage === "DRAFT").length,
        siblingTotal: siblings.length,
      };
    }),
  );

  const workingFingerprint = (
    await prisma.$queryRawUnsafe<{ name: string; cnt: bigint | number }[]>(
      `SELECT 'Topic' name, COUNT(*) cnt FROM Topic UNION ALL SELECT 'VideoLesson', COUNT(*) FROM VideoLesson UNION ALL SELECT 'Question', COUNT(*) FROM Question UNION ALL SELECT 'MistakeRetry', COUNT(*) FROM MistakeRetry`,
    )
  ).map((row) => ({ name: row.name, cnt: Number(row.cnt) }));

  const out = {
    allVideoByStatus: allV,
    confirmedVideos: confirmed,
    suggestedVideosOutside7: suggestedNotIn7,
    studyTasks,
    missingOptionsQuestions: missing,
    siblingNav,
    workingFingerprint,
  };
  const outDir = process.env.STAGE6A_OUT_DIR ?? path.join(process.cwd(), "stage6a-audit");
  writeFileSync(path.join(outDir, "stage6a-extra.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ confirmed: confirmed.length, suggestedOutside7: suggestedNotIn7.length, missingOptions: missing.length }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
