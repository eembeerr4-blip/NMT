import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const prodDb = process.argv[2] || "D:/НМТ Сайт/NMT-academy/prisma/dev.db";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const db = new DatabaseSync(prodDb, { readOnly: true });
const secs = db
  .prepare(
    `SELECT id, title, parentId, subjectId, coverage, sortOrder, length(lessonJson) AS lessonLen FROM Topic WHERE id LIKE 's7a-sec-%' ORDER BY id`,
  )
  .all();

const allowlist = [
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

const allowTopics = db
  .prepare(
    `SELECT id, title, parentId, subjectId, coverage FROM Topic WHERE id IN (${allowlist.map(() => "?").join(",")}) ORDER BY id`,
  )
  .all(...allowlist);

const subjects = ["geography", "ukrainian", "math", "history", "biology"];
const subjectRoots = {};
for (const sid of subjects) {
  subjectRoots[sid] = db
    .prepare(
      `SELECT id, title, parentId, coverage FROM Topic WHERE subjectId=? AND parentId IS NULL ORDER BY sortOrder, id LIMIT 30`,
    )
    .all(sid);
}

function findSimilarSection(titleFragment, subjectId) {
  return db
    .prepare(
      `SELECT id, title, parentId, coverage FROM Topic WHERE subjectId=? AND id NOT LIKE 's7a-%' AND title LIKE ? ORDER BY id LIMIT 10`,
    )
    .all(subjectId, `%${titleFragment.slice(0, 12)}%`);
}

const sectionReport = secs.map((s) => {
  const children = db
    .prepare(`SELECT id, title, coverage, parentId FROM Topic WHERE parentId=? ORDER BY id`)
    .all(s.id);
  const pkgRef = [];
  for (const pkgFile of [
    "packages-v2/stage7a1-geography.package.json",
    "packages-v2/stage7a1-ukrainian.package.json",
    "packages-v2/stage7a1-math.package.json",
    "packages-v2/stage7a1-history.package.json",
    "packages-v2/stage7a1-biology.package.json",
  ]) {
    const raw = readFileSync(path.join(repoRoot, "content/stage7a", pkgFile), "utf8");
    if (raw.includes(`"code": "${s.id}"`)) pkgRef.push(pkgFile);
  }
  return {
    ...s,
    children,
    packageFiles: pkgRef,
    similarExistingTopics: findSimilarSection(s.title || s.id, s.subjectId),
  };
});

db.close();

console.log(
  JSON.stringify(
    {
      prodDb,
      sectionCount: secs.length,
      sections: sectionReport,
      allowlistTopics: allowTopics,
      subjectRootSamples: subjectRoots,
    },
    null,
    2,
  ),
);

export { sectionReport, prodDb, secs, allowTopics };
