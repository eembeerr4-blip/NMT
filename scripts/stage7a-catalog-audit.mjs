import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";

const db = new DatabaseSync(process.argv[2] ?? "D:/НМТ Сайт/backups/stage7a-catalog-source.db");
const mapPath = process.argv[3] ?? "D:/НМТ Сайт/NMT-academy/prisma/content/nmt-curriculum-map.v1.json";

const topics = db.prepare("SELECT id, subjectId, title, coverage, parentId, length(lessonJson) lessonLen FROM Topic ORDER BY subjectId, sortOrder, id").all();
const ready = topics.filter((t) => t.coverage === "READY").map((t) => t.id);
const bySubject = {};
for (const t of topics) {
  bySubject[t.subjectId] ??= { total: 0, ready: 0, draft: 0, partial: 0, verified: 0, empty: 0, candidates: [] };
  const b = bySubject[t.subjectId];
  b.total++;
  if (t.coverage === "READY") b.ready++;
  else if (t.coverage === "DRAFT") b.draft++;
  else if (t.coverage === "PARTIAL") b.partial++;
  else if (t.coverage === "VERIFIED") b.verified++;
  if ((t.lessonLen ?? 0) < 120) b.empty++;
  if (!ready.includes(t.id) && !t.parentId && t.coverage !== "READY" && (t.lessonLen ?? 0) < 800) {
    b.candidates.push({ id: t.id, title: t.title, coverage: t.coverage, lessonLen: t.lessonLen });
  }
}

let mapTopics = 0;
try {
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  const walk = (node) => {
    if (node?.topicId) mapTopics++;
    for (const c of node?.children ?? []) walk(c);
    for (const s of node?.sections ?? []) walk(s);
    for (const t of node?.topics ?? []) walk(t);
  };
  walk(map);
} catch {
  mapTopics = -1;
}

console.log(JSON.stringify({ topicCountSqlite: topics.length, readySevenPlus: ready, mapTopicsInJson: mapTopics, bySubject, readyIds: ready }, null, 2));
db.close();
