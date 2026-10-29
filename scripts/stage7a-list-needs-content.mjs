import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("D:/НМТ Сайт/backups/stage7a-catalog-source.db");
const rows = db
  .prepare(
    `SELECT t.id, t.subjectId, t.title, t.coverage, length(t.lessonJson) AS lessonLen,
     (SELECT COUNT(*) FROM Question q WHERE q.topicId = t.id) AS questionCount
     FROM Topic t
     WHERE t.coverage = 'NEEDS_CONTENT'
     ORDER BY t.subjectId, t.id`,
  )
  .all();
console.log(JSON.stringify(rows, null, 2));
console.error("count", rows.length);
db.close();
