import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("D:/НМТ Сайт/backups/stage7a-catalog-source.db");
const exclude = new Set([
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
]);
const rows = db
  .prepare(
    `SELECT t.id, t.subjectId, t.title, t.coverage, length(t.lessonJson) AS lessonLen,
     (SELECT COUNT(*) FROM Question q WHERE q.topicId = t.id) AS questionCount
     FROM Topic t ORDER BY t.subjectId, t.sortOrder`,
  )
  .all()
  .filter((r) => !exclude.has(r.id));
console.log(JSON.stringify(rows, null, 2));
db.close();
