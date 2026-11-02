import { writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const topics = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const p = new PrismaClient({
  datasources: { db: { url: "file:D:/НМТ Сайт/NMT-academy/prisma/dev.db?connection_limit=1" } },
});

async function main() {
  const qs = await p.question.findMany({
  where: { topicId: { in: topics }, verificationStatus: "DRAFT" },
  include: { options: { orderBy: { sortOrder: "asc" } } },
  orderBy: [{ topicId: "asc" }, { id: "asc" }],
});

const out = path.join("D:/НМТ Сайт/backups", "stage6f3-draft-export.json");
writeFileSync(
  out,
  JSON.stringify(
    qs.map((q) => ({
      id: q.id,
      topicId: q.topicId,
      type: q.type,
      difficulty: q.difficulty,
      prompt: q.prompt,
      explanation: q.explanation,
      correctAnswer: q.correctAnswer,
      options: q.options.map((o) => ({ label: o.label, text: o.text, id: o.id, matchKey: o.matchKey })),
    })),
    null,
    2,
  ),
);
  console.log(out, qs.length);
  await p.$disconnect();
}
main();
