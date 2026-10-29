import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ukrLex from "../content/stage7c/fixtures/ukr-lexicology-section-01.mjs";
import * as bioCell from "../content/stage7c/fixtures/bio-cell-sec-01.mjs";
import * as bioMol from "../content/stage7c/fixtures/zcode-biology-molecular-02.mjs";
import * as geo2 from "../content/stage7c/fixtures/geography-2.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function patchTopicInPackage(pkgPath, sectionCode, topicCode, topicData) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const section of pkg.sections) {
    if (section.code !== sectionCode) continue;
    for (const topic of section.topics) {
      if (topic.code !== topicCode) continue;
      topic.title = topicData.title ?? topic.title;
      topic.summary = topicData.summary ?? topic.summary;
      topic.lesson = topicData.lesson;
      topic.questions = topicData.questions;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      return true;
    }
  }
  throw new Error(`Topic ${topicCode} not found in ${pkgPath}`);
}

function patchGeo2() {
  const pkgPath = path.join(repoRoot, "content/stage7a/packages-v2/stage7a1-geography.package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const section of pkg.sections) {
    if (section.code !== "s7a-sec-geography-ua") continue;
    for (const topic of section.topics) {
      if (topic.code !== "geography-2") continue;
      topic.lesson.objectives = geo2.lessonPatch.objectives;
      topic.lesson.examples = geo2.lessonPatch.examples;
      topic.questions = geo2.questions;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      return;
    }
  }
  throw new Error("geography-2 not found");
}

patchTopicInPackage(
  path.join(repoRoot, "content/stage7a/packages-v2/stage7a1-ukrainian.package.json"),
  "s7a-sec-ukr-lex",
  ukrLex.topicId,
  { title: ukrLex.title, summary: ukrLex.summary, lesson: ukrLex.lesson, questions: ukrLex.questions },
);
patchTopicInPackage(
  path.join(repoRoot, "content/stage7a/packages-v2/stage7a1-biology.package.json"),
  "s7a-sec-bio-cell",
  bioCell.topicId,
  { title: bioCell.title, summary: bioCell.summary, lesson: bioCell.lesson, questions: bioCell.questions },
);
patchTopicInPackage(
  path.join(repoRoot, "content/stage7a/packages-v2/stage7a1-biology.package.json"),
  "s7a-sec-bio-molecular",
  bioMol.topicId,
  { title: bioMol.title, summary: bioMol.summary, lesson: bioMol.lesson, questions: bioMol.questions },
);
patchGeo2();

console.log(JSON.stringify({ ok: true, patched: [ukrLex.topicId, bioCell.topicId, bioMol.topicId, "geography-2"] }));
