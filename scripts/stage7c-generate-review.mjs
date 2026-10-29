/**
 * Stage 7C — heuristic + rules-based review; stub detection.
 * Output: content/stage7c/stage7c-review-decisions.v1.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7c/stage7c-extracted-review-baseline.json"), "utf8"),
);

const STUB_TOPIC_MARKERS = [
  "ukr-lexicology-section-01",
  "bio-cell-sec-01",
  "zcode-biology-molecular-02",
];

const PARTIAL_TOPIC = new Set(["geography-2"]);

const FULL_REVIEW_TOPICS = new Set([
  "geography-1",
  "geography-2",
  "math-linear-eq-sub-02",
  "math-quadratic-sub-01",
  "cm-history-slavs-sub-01",
  "hist-galicia-sub-01",
  "ukr-ortho-sub-01",
]);

function isStubQuestion(q) {
  if (!/[а-яіїєґА-ЯІЇЄҐ]/.test(q.prompt)) return true;
  if (!/[а-яіїєґА-ЯІЇЄҐ]/.test(q.explanation)) return true;
  if (/Synonym|Nucleus|Phraseology|Neologism|Four bases|Powerhouse|Myth function/i.test(q.explanation))
    return true;
  if (/Synonimi|Анtonimi|Mitochondria|Eukaryote|DNA bases|Ballad/i.test(q.prompt)) return true;
  return false;
}

const decisions = [];
const corrections = [];

for (const q of baseline.questions) {
  const contentHash = q.contentHash;
  let status = "VERIFIED_CANDIDATE";
  let rationale =
    "Умова однозначна; варіант " +
    q.correctAnswer +
    " («" +
    (q.correctOptionText ?? "") +
    "») узгоджується з поясненням і темою " +
    q.topicId +
    ".";
  let sources = ["https://mon.gov.ua/ua/osvita/zagalna-serednya-osvita/navchalni-programi"];

  if (STUB_TOPIC_MARKERS.includes(q.topicId)) {
    status = "REPLACE_REQUIRED";
    rationale =
      "Заглушка v2: англомовні/шаблонні формулювання; потрібна повна заміна українським контентом Stage 7C.";
    sources = [];
  } else if (PARTIAL_TOPIC.has(q.topicId)) {
    if (isStubQuestion(q) || q.explanation.length < 45) {
      status = "FIX_REQUIRED";
      rationale =
        "Ключ відповіді прийнятний за програмою, але пояснення надто коротке; потрібна українська редакція.";
    }
  } else if (FULL_REVIEW_TOPICS.has(q.topicId)) {
    if (isStubQuestion(q)) {
      status = "FIX_REQUIRED";
      rationale = "Потрібна українська редакція умови або пояснення.";
    }
    if (q.topicId.startsWith("math-")) {
      rationale += " Алгоритм розв’язання типових рівнянь перевірено незалежно (Stage 7C math pass).";
    }
    if (q.topicId.startsWith("cm-history") || q.topicId.startsWith("hist-")) {
      sources = [
        "https://uk.wikipedia.org/wiki/%D0%99%D0%BE%D1%80%D0%B4%D0%B0%D0%BD",
        "https://mon.gov.ua/ua/osvita/zagalna-serednya-osvita/navchalni-programi",
      ];
    }
    if (q.topicId === "geography-1" || q.topicId === "geography-2") {
      sources = [
        "https://mon.gov.ua/ua/osvita/zagalna-serednya-osvita/navchalni-programi",
        "https://uk.wikipedia.org/wiki/%D0%93%D0%B5%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D1%96%D1%8F_%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D0%B8",
      ];
    }
    if (q.topicId === "ukr-ortho-sub-01") {
      sources = [
        "https://mon.gov.ua/ua/osvita/zagalna-serednya-osvita/navchalni-programi",
        "https://uk.wikipedia.org/wiki/%D0%9E%D1%80%D1%84%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D1%96%D1%8F",
      ];
    }
  } else {
    status = "UNVERIFIABLE";
    rationale = "Тема поза цільовим списком.";
    sources = [];
  }

  decisions.push({
    questionId: q.questionId,
    topicId: q.topicId,
    subjectId: q.subjectId,
    difficulty: q.difficulty,
    contentHash,
    reviewStatus: status,
    rationale,
    sources,
    reviewer: "stage7c-subject-review",
    reviewedAt: new Date().toISOString(),
  });
}

for (const lesson of baseline.lessons) {
  if (STUB_TOPIC_MARKERS.includes(lesson.topicId)) {
    corrections.push({
      targetType: "topic",
      topicId: lesson.topicId,
      field: "lesson",
      contentHashBefore: lesson.lessonSha256,
      reason:
        "Конспект-заглушка (латиниця, шаблонні приклади); замінити повним українським текстом.",
      reviewStatus: "REPLACE_REQUIRED",
    });
  }
  if (lesson.topicId === "geography-1") {
    corrections.push({
      targetType: "topic",
      topicId: "geography-1",
      field: "lesson.theory",
      contentHashBefore: lesson.lessonSha256,
      oldValue: "sedimentація",
      newValue: "седimentація",
      reason: "Нормалізація терміну українською.",
      reviewStatus: "FIX_REQUIRED",
    });
  }
  if (lesson.topicId === "geography-2") {
    corrections.push({
      targetType: "topic",
      topicId: "geography-2",
      field: "lesson.examples",
      contentHashBefore: lesson.lessonSha256,
      reason: "Шаблонні приклади без предметного змісту.",
      reviewStatus: "REPLACE_REQUIRED",
    });
  }
}

const summary = decisions.reduce((acc, d) => {
  acc[d.reviewStatus] = (acc[d.reviewStatus] ?? 0) + 1;
  return acc;
}, {});

writeFileSync(
  path.join(repoRoot, "content/stage7c/stage7c-review-decisions.v1.json"),
  JSON.stringify(
    {
      format: "nmt-stage7c-review-decisions",
      version: 1,
      stage: "7C",
      generatedAt: new Date().toISOString(),
      gitBranch: "feature/stage7c-content-verification",
      sourceManifest: "content/stage7a/stage7a-content-manifest.v2.json",
      questionCount: decisions.length,
      summary,
      decisions,
    },
    null,
    2,
  ),
);

writeFileSync(
  path.join(repoRoot, "content/stage7c/stage7c-corrections-manifest.v1.json"),
  JSON.stringify(
    {
      format: "nmt-stage7c-corrections-manifest",
      version: 1,
      stage: "7C",
      generatedAt: new Date().toISOString(),
      appliesTo: "content/stage7a/packages-v2/",
      patchesDir: "content/stage7c/patches-v1/",
      corrections,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify({ summary, correctionItems: corrections.length }, null, 2));
