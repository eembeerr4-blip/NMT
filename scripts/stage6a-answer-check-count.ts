import { PrismaClient } from "@prisma/client";
import { parseLesson } from "../src/lib/lesson";

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
  for (const id of IDS) {
    const t = await prisma.topic.findUnique({ where: { id }, select: { title: true, lessonJson: true } });
    const lesson = parseLesson(t!.lessonJson);
    const withCheck = lesson!.examples.filter((e) => e.answerCheck).length;
    console.log(
      JSON.stringify({
        id,
        title: t!.title,
        examples: lesson!.examples.length,
        answerCheckExamples: withCheck,
        noSolution: lesson!.examples.filter((e) => e.answerCheck?.type === "no-solution").length,
      }),
    );
  }
  await prisma.$disconnect();
}

main();
