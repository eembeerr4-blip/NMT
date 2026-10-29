import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("D:/НМТ Сайт/backups/stage7a-catalog-source.db");
const r = db
  .prepare(
    `SELECT id, subjectId, title, coverage, length(lessonJson) AS ll,
     (SELECT COUNT(*) FROM Question q WHERE q.topicId = Topic.id) AS qc
     FROM Topic
     WHERE id LIKE 'ukr-lex%' OR id LIKE 'bio-cell-%' OR parentId IN ('ukr-lexicology-section-01','bio-cell-sec-01')
     ORDER BY id`,
  )
  .all();
console.log(JSON.stringify(r, null, 2));
db.close();
