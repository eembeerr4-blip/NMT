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
  const rows = await prisma.question.findMany({
    where: { topicId: { in: IDS } },
    select: { id: true, topicId: true, prompt: true, explanation: true },
  });
  const suspicious = rows.filter(
    (r) =>
      /[ыэъё]|Кодиру|кодиру|митоз и мейоз/i.test(r.prompt + r.explanation) ||
      /\bи\b.*\bмейоз\b/i.test(r.prompt),
  );
  console.log(JSON.stringify(suspicious.map((s) => ({ id: s.id, topicId: s.topicId, prompt: s.prompt.slice(0, 100) })), null, 2));
  await prisma.$disconnect();
}

main();
