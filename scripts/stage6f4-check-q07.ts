import { PrismaClient } from "@prisma/client";

const p = new PrismaClient({
  datasources: { db: { url: "file:D:/НМТ Сайт/NMT-academy/prisma/dev.db?connection_limit=1" } },
});

async function main() {
  const q = await p.question.findUniqueOrThrow({
    where: { id: "ukr-lex-02-q07" },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  for (const o of q.options) {
    const text = o.text;
    const codepoints = [...text].map((ch) => `${ch} U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
    const hasLatin = /[A-Za-z]/.test(text);
    console.log(JSON.stringify({ label: o.label, text, hasLatin, codepoints }, null, 2));
  }
  await p.$disconnect();
}
main();
