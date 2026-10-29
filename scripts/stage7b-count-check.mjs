import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(process.argv[2] || "D:/НМТ Сайт/NMT-academy/prisma/dev.db", {
  readOnly: true,
});
const ready = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];
const ph = ready.map(() => "?").join(",");
const readyVerified = db
  .prepare(
    `SELECT COUNT(*) AS c FROM Question WHERE verificationStatus='VERIFIED' AND topicId IN (${ph})`,
  )
  .get(...ready).c;
const totalVerified = db
  .prepare(`SELECT COUNT(*) AS c FROM Question WHERE verificationStatus='VERIFIED'`)
  .get().c;
const draft = db.prepare(`SELECT COUNT(*) AS c FROM Question WHERE verificationStatus='DRAFT'`).get().c;
const newLeaves = [
  "ukr-ortho-sub-01",
  "math-linear-eq-sub-02",
  "math-quadratic-sub-01",
  "cm-history-slavs-sub-01",
  "hist-galicia-sub-01",
];
const existingLeaves = newLeaves.filter(
  (id) => db.prepare(`SELECT 1 FROM Topic WHERE id=?`).get(id),
);
console.log(
  JSON.stringify(
    {
      readyVerified,
      totalVerified,
      draft,
      readyTopics: db.prepare(`SELECT COUNT(*) c FROM Topic WHERE coverage='READY'`).get().c,
      existingNewLeaves: existingLeaves,
    },
    null,
    2,
  ),
);
db.close();
