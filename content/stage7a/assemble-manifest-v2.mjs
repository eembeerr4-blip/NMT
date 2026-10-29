import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STAGE7A_V2_TOPIC_IDS,
  STAGE7A_V2_TOPICS,
  STAGE7A_DEFERRED_TOPICS,
  STAGE7A_DEFERRED_IDS,
  STAGE7A_V2_KEPT_IDS,
} from "./topic-definitions-v2.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "content/stage7a");
const packagesDir = path.join(outDir, "packages-v2");

const PROVENANCE = {
  origin: "original",
  title: "NMT Academy Stage 7A.1",
  license: "original",
  note: "Партія v2: 2×5 предметів NMT. Імпорт лише в QA до дозволу власника.",
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
      title: `Stage 7A.1 · ${subjectId}`,
      summary: "Службовий розділ імпорту Stage 7A.1.",
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

const bySubject = groupBySubject(STAGE7A_V2_TOPICS);
const packageFiles = [];
for (const [subjectId, topics] of bySubject) {
  const pkg = buildPackage(subjectId, topics);
  const fileName = `stage7a1-${subjectId}.package.json`;
  const filePath = path.join(packagesDir, fileName);
  const raw = JSON.stringify(pkg, null, 2);
  writeFileSync(filePath, raw, "utf8");
  packageFiles.push({
    subjectId,
    file: path.relative(outDir, filePath).replace(/\\/g, "/"),
    sha256: sha256(raw),
    topicIds: topics.map((t) => t.topicId),
    questionCount: topics.reduce((n, t) => n + t.questions.length, 0),
    createTopicIds: topics.filter((t) => !STAGE7A_V2_KEPT_IDS.includes(t.topicId)).map((t) => t.topicId),
  });
}

const reviewDecisions = STAGE7A_V2_TOPICS.flatMap((topic) =>
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

const subjectCounts = Object.fromEntries(
  [...bySubject.entries()].map(([id, topics]) => [id, topics.length]),
);

const manifest = {
  format: "nmt-stage7a-content-manifest",
  version: 2,
  stage: "7A.1",
  generatedAt: new Date().toISOString(),
  gitBranch: "feature/stage7a-first-content-batch",
  supersedes: "content/stage7a/stage7a-content-manifest.v1.json",
  topicIds: STAGE7A_V2_TOPIC_IDS,
  subjectDistribution: subjectCounts,
  expectedSubjectDistribution: {
    ukrainian: 2,
    math: 2,
    history: 2,
    biology: 2,
    geography: 2,
  },
  topics: STAGE7A_V2_TOPICS.map((t) => ({
    topicId: t.topicId,
    subjectId: t.subjectId,
    title: t.title,
    importMode: STAGE7A_V2_KEPT_IDS.includes(t.topicId) ? "fill-existing" : "create-new-stage2-id",
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
    expectedSubjects: 5,
  },
  verifiedCandidateCount: reviewDecisions.filter((d) => d.reviewStatus === "VERIFIED_CANDIDATE").length,
  draftCandidateCount: reviewDecisions.filter((d) => d.reviewStatus === "DRAFT_CANDIDATE").length,
};

writeFileSync(path.join(outDir, "stage7a-content-manifest.v2.json"), JSON.stringify(manifest, null, 2), "utf8");

const deferredPackages = groupBySubject(STAGE7A_DEFERRED_TOPICS);
const deferredPackageMeta = [];
for (const [subjectId, topics] of deferredPackages) {
  const pkg = buildPackage(subjectId, topics);
  const fileName = `stage7a-deferred-${subjectId}.package.json`;
  const filePath = path.join(outDir, "deferred-packages", fileName);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const raw = JSON.stringify(pkg, null, 2);
  writeFileSync(filePath, raw, "utf8");
  deferredPackageMeta.push({
    subjectId,
    file: path.relative(outDir, filePath).replace(/\\/g, "/"),
    sha256: sha256(raw),
    topicIds: topics.map((t) => t.topicId),
  });
}

const deferred = {
  format: "nmt-stage7a-deferred-content",
  version: 1,
  note: "Матеріали Stage 7A v1, виключені з першої партії v2 (хімія, література, зайва географія). Не імпортувати в batch v2.",
  sourceManifest: "content/stage7a/stage7a-content-manifest.v1.json",
  topicIds: STAGE7A_DEFERRED_IDS,
  packages: deferredPackageMeta,
  topics: STAGE7A_DEFERRED_TOPICS.map((t) => ({
    topicId: t.topicId,
    subjectId: t.subjectId,
    title: t.title,
    questionCount: t.questions.length,
    lessonSha256: sha256(JSON.stringify(t.lesson)),
  })),
};

writeFileSync(path.join(outDir, "stage7a-deferred-content.v1.json"), JSON.stringify(deferred, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      manifestV2: path.join(outDir, "stage7a-content-manifest.v2.json"),
      deferred: path.join(outDir, "stage7a-deferred-content.v1.json"),
      subjectCounts,
      verifiedCandidateCount: manifest.verifiedCandidateCount,
      draftCandidateCount: manifest.draftCandidateCount,
    },
    null,
    2,
  ),
);
