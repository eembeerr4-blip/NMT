import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const prod = process.argv[2] || "D:/НМТ Сайт/NMT-academy/prisma/dev.db";
const baselinePath =
  process.argv[3] ||
  "D:/НМТ Сайт/backups/stage7b-before-import-2026-10-29T13-33-07/baseline-production.json";

const allow = [
  "geography-1",
  "geography-2",
  "ukr-lexicology-section-01",
  "ukr-ortho-sub-01",
  "math-linear-eq-sub-02",
  "math-quadratic-sub-01",
  "cm-history-slavs-sub-01",
  "hist-galicia-sub-01",
  "bio-cell-sec-01",
  "zcode-biology-molecular-02",
];

const db = new DatabaseSync(prod, { readOnly: true });
const rows = [];
let exTotal = 0;
for (const id of allow) {
  const t = db.prepare(`SELECT id, coverage, parentId, lessonJson FROM Topic WHERE id=?`).get(id);
  const lesson = JSON.parse(t.lessonJson || "{}");
  const ex = (lesson.examples ?? []).length;
  exTotal += ex;
  const diff = db
    .prepare(`SELECT difficulty, COUNT(*) AS c FROM Question WHERE topicId=? GROUP BY difficulty`)
    .all(id);
  rows.push({ id, coverage: t.coverage, parentId: t.parentId, examples: ex, difficulty: diff });
}
const packageTopics = db
  .prepare(`SELECT id, parentId, coverage FROM Topic WHERE id LIKE 's7a-%' ORDER BY id`)
  .all();
const s7aVerified = db
  .prepare(
    `SELECT COUNT(*) AS c FROM Question WHERE id LIKE 's7a-%' AND verificationStatus='VERIFIED'`,
  )
  .get().c;
db.close();

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
console.log(
  JSON.stringify(
    {
      examplesTotal: exTotal,
      allowlistTopics: rows,
      packageTopics,
      s7aVerified,
      baselineTopicCount: baseline.counts.Topic,
    },
    null,
    2,
  ),
);
