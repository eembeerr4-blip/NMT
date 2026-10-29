import Database from "better-sqlite3";

const dbPath = process.argv[2] ?? "D:/НМТ Сайт/backups/stage7a-catalog-source.db";
const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    `SELECT id, subjectId, title, coverage, length(lessonJson) as lessonLen
     FROM Topic
     WHERE coverage = 'NEEDS_CONTENT'
        OR (length(COALESCE(lessonJson,'')) = 0 AND coverage != 'READY')
     ORDER BY subjectId, id`,
  )
  .all();
console.log(JSON.stringify(rows, null, 2));
console.error("count", rows.length);
