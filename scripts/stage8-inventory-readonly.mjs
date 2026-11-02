import { DatabaseSync } from "node:sqlite";

const dbPath = "D:/НМТ Сайт/NMT-academy/prisma/dev.db";
const subjects = ["ukrainian", "math", "history", "biology"];
const db = new DatabaseSync(dbPath, { readOnly: true });

const subjectRows = db
  .prepare(`SELECT id, name FROM Subject WHERE id IN (${subjects.map(() => "?").join(",")}) ORDER BY id`)
  .all(...subjects);

const report = [];
for (const subject of subjectRows) {
  const topics = db
    .prepare(
      `SELECT id, title, coverage, parentId FROM Topic WHERE subjectId = ? ORDER BY sortOrder, id`,
    )
    .all(subject.id);
  const ready = topics.filter((t) => t.coverage === "READY").length;
  const draft = topics.filter((t) => t.coverage === "DRAFT").length;
  const verified = topics.filter((t) => t.coverage === "VERIFIED").length;
  const questions = db
    .prepare(
      `SELECT verificationStatus, COUNT(*) AS c FROM Question WHERE subjectId = ? GROUP BY verificationStatus`,
    )
    .all(subject.id);
  report.push({ subjectId: subject.id, subjectName: subject.name, topicCounts: { ready, draft, verified, total: topics.length }, questions, topics: topics.slice(0, 40) });
}
db.close();
console.log(JSON.stringify(report, null, 2));
