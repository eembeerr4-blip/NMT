import { PrismaClient } from "@prisma/client";
import { parseLesson } from "@/lib/lesson";
import { lessonAccess } from "@/lib/readiness";

const TOPICS = [
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
  const rows = [];
  for (const topicId of TOPICS) {
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        questions: { where: { verificationStatus: "VERIFIED" }, select: { difficulty: true, verificationStatus: true } },
        videos: { select: { reviewStatus: true, isPrimary: true } },
        children: { select: { id: true } },
      },
    });
    const access = lessonAccess(topic);
    rows.push({
      topicId,
      coverage: topic.coverage,
      studentAvailable: access.available,
      theory: access.theory,
      examples: access.available && Boolean(parseLesson(topic.lessonJson)?.examples.length),
      practice: access.practice,
      video: access.video,
    });
  }

  const draftSample = await prisma.topic.findFirst({
    where: { id: { notIn: TOPICS }, coverage: { not: "READY" } },
    select: { id: true, coverage: true },
  });
  let draftProtection = null;
  if (draftSample) {
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: draftSample.id },
      include: {
        questions: { where: { verificationStatus: "VERIFIED" }, select: { difficulty: true, verificationStatus: true } },
        videos: { select: { reviewStatus: true, isPrimary: true } },
        children: { select: { id: true } },
      },
    });
    draftProtection = { id: draftSample.id, coverage: draftSample.coverage, available: lessonAccess(topic).available };
  }

  const recentTasks = await prisma.studyTask.findMany({
    orderBy: { id: "desc" },
    take: 8,
    select: { id: true, userId: true, topicId: true, dateKey: true, kind: true, createdAt: true, title: true },
  });

  console.log(
    JSON.stringify(
      {
        published: rows,
        draftProtection,
        studyTaskCount: await prisma.studyTask.count(),
        recentStudyTasks: recentTasks,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
