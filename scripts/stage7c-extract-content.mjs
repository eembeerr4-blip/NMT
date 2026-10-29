import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7a/stage7a-content-manifest.v2.json"), "utf8"),
);

const packages = manifest.packages.map((p) => ({
  ...p,
  raw: JSON.parse(readFileSync(path.join(repoRoot, "content/stage7a", p.file), "utf8")),
}));

function sha(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const questions = [];
const lessons = [];

for (const pkg of packages) {
  for (const section of pkg.raw.sections) {
    for (const topic of section.topics) {
      const lessonBlob = JSON.stringify(topic.lesson, null, 0);
      lessons.push({
        topicId: topic.code,
        subjectId: pkg.subjectId,
        sectionCode: section.code,
        lessonSha256: sha(lessonBlob),
        exampleCount: topic.lesson.examples?.length ?? 0,
        theoryLen: topic.lesson.theory?.length ?? 0,
      });
      for (const q of topic.questions) {
        const labels = new Set((q.options ?? []).map((o) => o.label));
        const optionTexts = Object.fromEntries((q.options ?? []).map((o) => [o.label, o.text]));
        const correctLabel = q.correctAnswer?.trim();
        const correctInOptions = labels.has(correctLabel);
        questions.push({
          questionId: q.code,
          topicId: topic.code,
          subjectId: pkg.subjectId,
          difficulty: q.difficulty,
          type: q.type,
          prompt: q.prompt,
          correctAnswer: q.correctAnswer,
          correctOptionText: optionTexts[correctLabel] ?? null,
          explanation: q.explanation,
          options: q.options,
          contentHash: sha(JSON.stringify({ prompt: q.prompt, correctAnswer: q.correctAnswer, options: q.options })),
          autoChecks: {
            correctInOptions,
            optionCount: q.options?.length ?? 0,
            explanationLen: q.explanation?.length ?? 0,
          },
        });
      }
    }
  }
}

const out = {
  extractedAt: new Date().toISOString(),
  questionCount: questions.length,
  lessonCount: lessons.length,
  autoIssueCount: questions.filter((q) => !q.autoChecks.correctInOptions).length,
  questions,
  lessons,
};

const outPath = path.join(repoRoot, "content/stage7c/stage7c-extracted-review-baseline.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ outPath, questionCount: out.questionCount, autoIssues: out.autoIssueCount }, null, 2));
