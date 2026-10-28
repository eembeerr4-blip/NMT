import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "content", "stage6c", "stage6c-video-candidates.v1.json");
const htmlPath = path.join(root, "content", "stage6c", "stage6c-owner-review.html");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");
const errors = [];

if (manifest.format !== "nmt-stage6c-video-candidates") errors.push("bad format");
if (manifest.version !== 1) errors.push("bad version");
if (manifest.workingDatabaseChanged !== false) errors.push("workingDatabaseChanged must be false");
if (manifest.automaticConfirmed !== false) errors.push("automaticConfirmed must be false");
if (manifest.lessons.length !== 7) errors.push("expected 7 lessons");

const topicIds = new Set();
const youtubeIds = new Set();

function collectCandidate(c, topicId, label) {
  if (!c?.youtubeId) return;
  if (!/^[\w-]{11}$/.test(c.youtubeId)) errors.push(`${topicId} ${label} bad id ${c.youtubeId}`);
  youtubeIds.add(c.youtubeId);
  if (!c.url.includes(c.youtubeId)) errors.push(`${c.youtubeId} url mismatch`);
}

for (const lesson of manifest.lessons) {
  if (topicIds.has(lesson.topicId)) errors.push(`duplicate topic ${lesson.topicId}`);
  topicIds.add(lesson.topicId);
  collectCandidate(lesson.currentPrimary, lesson.topicId, "current");
  collectCandidate(lesson.recommendation.primary, lesson.topicId, "rec.primary");
  collectCandidate(lesson.recommendation.supplement, lesson.topicId, "rec.supplement");
  for (const alt of lesson.alternatives ?? []) collectCandidate(alt, lesson.topicId, "alt");
  if (!html.includes(lesson.topicId)) errors.push(`html missing ${lesson.topicId}`);
  if (!html.includes(lesson.currentPrimary.youtubeId)) errors.push(`html missing current ${lesson.currentPrimary.youtubeId}`);
}

async function oembedOk(id) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
  );
  return res.ok;
}

const oembedFailures = [];
for (const id of [...youtubeIds].sort()) {
  if (!(await oembedOk(id))) oembedFailures.push(id);
}
if (oembedFailures.length) errors.push(`oembed failed: ${oembedFailures.join(", ")}`);

const qa = {
  checkedAt: new Date().toISOString(),
  topicCount: manifest.lessons.length,
  uniqueYoutubeIds: youtubeIds.size,
  oembedFailures,
  errors,
  pass: errors.length === 0,
  workingDatabaseChanged: false,
  automaticConfirmed: false,
  subjectCorrectnessNotClaimed: true,
};

writeFileSync(path.join(root, "content", "stage6c", "stage6c-qa.json"), JSON.stringify(qa, null, 2) + "\n");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("QA PASS", youtubeIds.size, "youtube ids");
