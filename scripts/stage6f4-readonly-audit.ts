import { PrismaClient } from "@prisma/client";
import { lessonReadiness } from "../src/lib/readiness";

const topics = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const PRIMARY: Record<string, string> = {
  "ukr-lex-01-meaning": "NDmd6xU9F2E",
  "ukr-lex-02-syn-ant-hom": "scigg_eN4qs",
  "ukr-lex-03-phraseology": "wm0X68H_WtQ",
  "bio-cell-01-eukaryotic-cell": "bBymW0PtVT0",
  "zcode-biology-molecular-dna-rna": "G63P4uoP6Fs",
  "zcode-biology-molecular-protein-synth": "vs6GLwIxI-U",
  "zcode-biology-molecular-division": "19a17ENs64g",
};

async function main() {
  const p = new PrismaClient();
  const integrity = (await p.$queryRawUnsafe("PRAGMA integrity_check")) as {
    integrity_check: string;
  }[];
  const fk = (await p.$queryRawUnsafe("PRAGMA foreign_key_check") as unknown[]).length;

  const q07 = await p.question.findUnique({
    where: { id: "ukr-lex-02-q07" },
    include: { options: { orderBy: { label: "asc" } } },
  });

  const verified = await p.question.count({
    where: { topicId: { in: topics }, verificationStatus: "VERIFIED" },
  });
  const draft = await p.question.count({
    where: { topicId: { in: topics }, verificationStatus: "DRAFT" },
  });

  const userCounts = {
    testAttempt: await p.testAttempt.count(),
    answer: await p.answer.count(),
    studyTask: await p.studyTask.count(),
    userTopicProgress: await p.userTopicProgress.count(),
    mistake: await p.mistake.count(),
    reviewSchedule: await p.reviewSchedule.count(),
  };

  const confirmed = await p.videoLesson.count({
    where: { topicId: { in: topics }, reviewStatus: "CONFIRMED" },
  });

  const perTopic = [];
  for (const topicId of topics) {
    const topic = await p.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { questions: true, videos: true },
    });
    const r = lessonReadiness(topic);
    const primary = topic.videos.find((v) => v.isPrimary);
    const target = topic.videos.find((v) => v.youtubeId === PRIMARY[topicId]);
    perTopic.push({
      topicId,
      coverage: topic.coverage,
      verifiedQ: topic.questions.filter((q) => q.verificationStatus === "VERIFIED").length,
      targetStatus: target?.reviewStatus ?? "missing",
      targetIsPrimary: target?.isPrimary ?? false,
      isPrimaryYoutube: primary?.youtubeId ?? null,
      primaryStatus: primary?.reviewStatus ?? null,
      ready: r.ready,
      checks: {
        theory: r.theory,
        examples: r.examples,
        practice: r.practice,
        video: r.video,
      },
    });
  }

  const q07Options = q07?.options.map((o) => ({
    label: o.label,
    text: o.text,
    codepoints: [...o.text].map((c) => c.codePointAt(0)?.toString(16)).join(" "),
  }));

  console.log(
    JSON.stringify(
      {
        integrity: integrity[0]?.integrity_check,
        fk,
        verified,
        draft,
        confirmedVideos: confirmed,
        userCounts,
        q07: { correctAnswer: q07?.correctAnswer, options: q07Options },
        perTopic,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
}

main();
