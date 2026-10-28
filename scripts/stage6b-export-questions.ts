import { writeFileSync, mkdirSync } from "node:fs";
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
  const questions = await prisma.question.findMany({
    where: { topicId: { in: IDS } },
    include: { options: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ topicId: "asc" }, { difficulty: "asc" }, { id: "asc" }],
  });
  const outDir = path.join(process.cwd(), "content", "stage6b");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "exported-questions-baseline.json"), JSON.stringify(questions, null, 2));
  console.log("count", questions.length);
  await prisma.$disconnect();
}

main();
