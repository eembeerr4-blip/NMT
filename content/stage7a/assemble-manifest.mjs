import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STAGE7A_TOPIC_IDS, STAGE7A_TOPICS } from "./topic-definitions.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "content/stage7a");
const packagesDir = path.join(outDir, "packages");

const PROVENANCE = {
  origin: "original",
  title: "NMT Academy Stage 7A",
  license: "original",
  note: "Перша партія розширення контенту. Імпорт лише в QA до окремого дозволу власника.",
};

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function groupBySubject(topics) {
  const map = new Map();
  for (const topic of topics) {
    const list = map.get(topic.subjectId) ?? [];
    list.push(topic);
    map.set(topic.subjectId, list);
  }
  return map;
}

function buildPackage(subjectId, topics) {
  const sectionByCode = new Map();
  for (const topic of topics) {
    const section = sectionByCode.get(topic.sectionCode) ?? {
      code: topic.sectionCode,
      title: `Stage 7A · ${subjectId}`,
      summary: "Службовий розділ імпорту Stage 7A (не змінює структуру програмних розділів).",
      topics: [],
    };
    section.topics.push({
      code: topic.topicId,
      title: topic.title,
      summary: topic.summary,
      estimatedMin: topic.estimatedMin,
      lesson: topic.lesson,
      questions: topic.questions,
    });
    sectionByCode.set(topic.sectionCode, section);
  }
  return {
    format: "nmt-content-package",
    version: 1,
    subjectId,
    provenance: PROVENANCE,
    sections: [...sectionByCode.values()],
  };
}

mkdirSync(packagesDir, { recursive: true });

const bySubject = groupBySubject(STAGE7A_TOPICS);
const packageFiles = [];
for (const [subjectId, topics] of bySubject) {
  const pkg = buildPackage(subjectId, topics);
  const fileName = `stage7a-${subjectId}.package.json`;
  const filePath = path.join(packagesDir, fileName);
  const raw = JSON.stringify(pkg, null, 2);
  writeFileSync(filePath, raw, "utf8");
  packageFiles.push({
    subjectId,
    file: path.relative(outDir, filePath).replace(/\\/g, "/"),
    sha256: sha256(raw),
    topicIds: topics.map((t) => t.topicId),
    questionCount: topics.reduce((n, t) => n + t.questions.length, 0),
  });
}

const reviewDecisions = STAGE7A_TOPICS.flatMap((topic) =>
  topic.reviewDecisions.map((d) => ({
    questionId: d.questionId,
    topicId: topic.topicId,
    reviewStatus: d.reviewStatus,
    evidence: d.evidence,
    sources: d.sources ?? [],
    errors: d.errors ?? [],
    fixes: d.fixes ?? [],
    finalDecision: d.reviewStatus,
  })),
);

const manifest = {
  format: "nmt-stage7a-content-manifest",
  version: 1,
  generatedAt: new Date().toISOString(),
  gitBranch: "feature/stage7a-first-content-batch",
  topicIds: STAGE7A_TOPIC_IDS,
  topics: STAGE7A_TOPICS.map((t) => ({
    topicId: t.topicId,
    subjectId: t.subjectId,
    title: t.title,
    lessonSha256: sha256(JSON.stringify(t.lesson)),
    exampleCount: t.lesson.examples.length,
    questionCount: t.questions.length,
    difficultyCounts: {
      EASY: t.questions.filter((q) => q.difficulty === "EASY").length,
      MEDIUM: t.questions.filter((q) => q.difficulty === "MEDIUM").length,
      HARD: t.questions.filter((q) => q.difficulty === "HARD").length,
    },
  })),
  packages: packageFiles,
  reviewDecisions,
  validation: {
    expectedTopics: 10,
    expectedQuestions: 120,
    expectedDifficultyPerTopic: { EASY: 4, MEDIUM: 5, HARD: 3 },
  },
  verifiedCandidateCount: reviewDecisions.filter((d) => d.reviewStatus === "VERIFIED_CANDIDATE").length,
  draftCandidateCount: reviewDecisions.filter((d) => d.reviewStatus === "DRAFT_CANDIDATE").length,
};

const manifestPath = path.join(outDir, "stage7a-content-manifest.v1.json");
const manifestRaw = JSON.stringify(manifest, null, 2);
writeFileSync(manifestPath, manifestRaw, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      manifest: manifestPath,
      packages: packageFiles,
      topics: STAGE7A_TOPIC_IDS.length,
      questions: STAGE7A_TOPICS.reduce((n, t) => n + t.questions.length, 0),
      verifiedCandidateCount: manifest.verifiedCandidateCount,
      draftCandidateCount: manifest.draftCandidateCount,
    },
    null,
    2,
  ),
);
