import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const db = new DatabaseSync(path.join(process.cwd(), "prisma", "dev.db"));
const allow = new Set([
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
]);
const topics = db.prepare("SELECT id, coverage FROM Topic ORDER BY id").all();
const ready = topics.filter((t) => t.coverage === "READY");
const draft = topics.filter((t) => t.coverage === "DRAFT");
const changed = topics.filter((t) => allow.has(t.id) ? t.coverage !== "READY" : t.coverage === "READY" && allow.has(t.id) === false);
const verifiedSeven = db
  .prepare(
    "SELECT COUNT(*) AS c FROM Question WHERE topicId IN (?,?,?,?,?,?,?) AND verificationStatus='VERIFIED'",
  )
  .get(...allow);
const answerCheck = db.prepare("SELECT lessonJson FROM Topic").all();
let checks = 0;
for (const row of answerCheck) {
  try {
    const lesson = JSON.parse(row.lessonJson || "{}");
    for (const ex of lesson.examples ?? []) if (ex.answerCheck) checks += 1;
  } catch {
    /* ignore */
  }
}
console.log(
  JSON.stringify(
    {
      integrity: db.prepare("PRAGMA integrity_check").get(),
      fk: db.prepare("PRAGMA foreign_key_check").all().length,
      readyCount: ready.length,
      draftCount: draft.length,
      allowlistAllReady: [...allow].every((id) => topics.find((t) => t.id === id)?.coverage === "READY"),
      extraReadyOutsideAllowlist: ready.filter((t) => !allow.has(t.id)).map((t) => t.id),
      verifiedInSeven: verifiedSeven.c,
      answerCheck: checks,
      videoStatuses: db.prepare("SELECT reviewStatus, COUNT(*) c FROM VideoLesson GROUP BY reviewStatus").all(),
    },
    null,
    2,
  ),
);
db.close();
