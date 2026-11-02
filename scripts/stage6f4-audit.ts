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
  const p = new PrismaClient({
    datasources: { db: { url: "file:D:/НМТ Сайт/NMT-academy/prisma/dev.db?connection_limit=1" } },
  });
  const integrity = await p.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  const fk = (await p.$queryRawUnsafe("PRAGMA foreign_key_check")).length;
  const verified = await p.question.count({
    where: { topicId: { in: topics }, verificationStatus: "VERIFIED" },
  });
  const draft = await p.question.count({
    where: { topicId: { in: topics }, verificationStatus: "DRAFT" },
  });
  const perTopic = [];
  for (const topicId of topics) {
    const topic = await p.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { questions: true, videos: true },
    });
    const r = lessonReadiness(topic);
    const primary = topic.videos.find((v) => v.isPrimary);
    const confirmed = topic.videos.filter((v) => v.reviewStatus === "CONFIRMED");
    const target = topic.videos.find((v) => v.youtubeId === PRIMARY[topicId]);
    perTopic.push({
      topicId,
      coverage: topic.coverage,
      verified: topic.questions.filter((q) => q.verificationStatus === "VERIFIED").length,
      confirmedYoutube: confirmed.map((v) => v.youtubeId),
      targetPrimaryStatus: target?.reviewStatus ?? "missing",
      isPrimary: primary?.youtubeId ?? null,
      readiness: r,
    });
  }
  const studyTask = await p.studyTask.count();
  console.log(
    JSON.stringify(
      {
        integrity: integrity[0]?.integrity_check,
        fk,
        verified,
        draft,
        studyTask,
        perTopic,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
}
main();
