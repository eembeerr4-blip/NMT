import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = process.argv.includes("--v2")
  ? path.join(root, "content/stage7a/stage7a-content-manifest.v2.json")
  : path.join(root, "content/stage7a/stage7a-content-manifest.v1.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const errors = [];
const warnings = [];

if (manifest.format !== "nmt-stage7a-content-manifest") {
  errors.push("Invalid manifest format");
}
if (manifest.version !== 1 && manifest.version !== 2) {
  errors.push(`Unexpected manifest version ${manifest.version}`);
}

const topicIds = new Set(manifest.topicIds ?? []);
if (topicIds.size !== 10) errors.push(`Expected 10 topicIds, got ${topicIds.size}`);

const questionIds = new Set();
if (manifest.version === 2) {
  const expected = manifest.expectedSubjectDistribution ?? {};
  for (const [sub, n] of Object.entries(expected)) {
    if ((manifest.subjectDistribution?.[sub] ?? 0) !== n) {
      errors.push(`Subject ${sub}: expected ${n}, got ${manifest.subjectDistribution?.[sub]}`);
    }
  }
}
for (const topic of manifest.topics ?? []) {
  const d = topic.difficultyCounts ?? {};
  if (d.EASY !== 4 || d.MEDIUM !== 5 || d.HARD !== 3) {
    errors.push(`${topic.topicId}: bad difficulty distribution ${JSON.stringify(d)}`);
  }
  if (topic.exampleCount < 4) errors.push(`${topic.topicId}: fewer than 4 examples`);
}

for (const decision of manifest.reviewDecisions ?? []) {
  if (questionIds.has(decision.questionId)) errors.push(`Duplicate review questionId ${decision.questionId}`);
  questionIds.add(decision.questionId);
  if (!topicIds.has(decision.topicId)) errors.push(`Review topicId missing from batch: ${decision.topicId}`);
}

if (questionIds.size !== 120) errors.push(`Expected 120 review decisions, got ${questionIds.size}`);

for (const pkg of manifest.packages ?? []) {
  const pkgPath = path.join(root, "content/stage7a", pkg.file);
  const raw = readFileSync(pkgPath, "utf8");
  const hash = createHash("sha256").update(raw, "utf8").digest("hex");
  if (hash !== pkg.sha256) errors.push(`Package hash mismatch: ${pkg.file}`);
  const json = JSON.parse(raw);
  if (json.format !== "nmt-content-package") errors.push(`${pkg.file}: bad format`);
  let qCount = 0;
  for (const section of json.sections ?? []) {
    for (const topic of section.topics ?? []) {
      if (!topicIds.has(topic.code)) warnings.push(`${pkg.file}: topic ${topic.code} not in manifest topicIds`);
      qCount += (topic.questions ?? []).length;
    }
  }
  if (qCount !== pkg.questionCount) errors.push(`${pkg.file}: questionCount metadata ${pkg.questionCount} vs ${qCount}`);
}

const verified = manifest.reviewDecisions.filter((d) => d.reviewStatus === "VERIFIED_CANDIDATE").length;
const draft = manifest.reviewDecisions.filter((d) => d.reviewStatus === "DRAFT_CANDIDATE").length;
if (verified + draft !== 120) errors.push("Review status counts do not sum to 120");

console.log(
  JSON.stringify(
    {
      ok: errors.length === 0,
      errors,
      warnings,
      verifiedCandidateCount: verified,
      draftCandidateCount: draft,
      manifestPath,
    },
    null,
    2,
  ),
);
process.exit(errors.length ? 1 : 0);
