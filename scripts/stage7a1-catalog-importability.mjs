import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("D:/НМТ Сайт/backups/stage7a-catalog-source.db");
const subjects = ["math", "history", "ukrainian"];
for (const subjectId of subjects) {
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.coverage, t.parentId, length(t.lessonJson) AS ll,
       (SELECT COUNT(*) FROM Question q WHERE q.topicId = t.id) AS qc,
       (SELECT COUNT(*) FROM Topic c WHERE c.parentId = t.id) AS children
       FROM Topic t WHERE t.subjectId = ? ORDER BY t.sortOrder, t.id`,
    )
    .all(subjectId);
  console.log("\n===", subjectId, "===");
  for (const r of rows) {
    const importable =
      r.coverage === "NEEDS_CONTENT" && r.ll === 0
        ? "FILL"
        : r.coverage === "DRAFT" && r.ll === 0
          ? "FILL"
          : r.coverage === "DRAFT"
            ? "UPDATE-DRAFT"
            : r.ll > 0 && r.coverage !== "DRAFT"
              ? "PROTECTED"
              : "OTHER";
    console.log(JSON.stringify({ ...r, importable }));
  }
}
db.close();
