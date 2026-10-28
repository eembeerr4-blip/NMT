import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { gradeAnswer } from "../src/lib/grade";
import { lessonReadiness } from "../src/lib/readiness";
import { prepareQuestion } from "../src/lib/question-input";
import { initializeSQLite } from "../src/lib/sqlite-init";

const workingDb = "D:/НМТ Сайт/NMT-academy/prisma/dev.db";
const before = statSync(workingDb);
const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "content/stage6b/stage6b-question-bank-manifest.v2.json"), "utf8"));
const html = readFileSync(path.join(process.cwd(), "content/stage6b/stage6b2-owner-review.html"), "utf8");

const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage6b2-"));
const database = path.join(folder, "qa.db");
const databaseUrl = `file:${database.replaceAll("\\", "/")}`;
const prismaCli = ["node_modules/prisma/build/index.js", "D:/НМТ Сайт/NMT-academy/node_modules/prisma/build/index.js"]
  .map((candidate) => path.resolve(candidate))
  .find((candidate) => { try { statSync(candidate); return true; } catch { return false; } });
if (!prismaCli) throw new Error("Prisma CLI not found");
execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "pipe",
  timeout: 120000,
});
async function main() {
const afterMigrate = statSync(workingDb);
if (afterMigrate.size !== before.size || afterMigrate.mtimeMs !== before.mtimeMs) {
  throw new Error("Working SQLite changed during migrate");
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
await initializeSQLite(prisma);

const questions = manifest.questions as Array<{
  id: string;
  subjectId: string;
  topicId: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  correctAnswer: string;
  verificationStatus: string;
  contentHash: string;
  options: { id: string; label: string; text: string; matchKey: string | null }[];
}>;

const subjectIds = [...new Set(questions.map((question) => question.subjectId))];
for (const [index, id] of subjectIds.entries()) {
  await prisma.subject.create({
    data: { id, name: id, shortName: id, description: "QA", color: "#000", sortOrder: index },
  });
}
const topicIds = [...new Set(questions.map((question) => question.topicId))];
for (const [index, id] of topicIds.entries()) {
  const subjectId = questions.find((question) => question.topicId === id)!.subjectId;
  await prisma.topic.create({
    data: { id, subjectId, title: id, sortOrder: index, coverage: "DRAFT" },
  });
}
for (const question of questions) {
  await prisma.question.create({
    data: {
      id: question.id,
      subjectId: question.subjectId,
      topicId: question.topicId,
      type: question.type,
      difficulty: question.difficulty,
      prompt: question.prompt,
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      source: "stage6b2-qa",
      verificationStatus: "DRAFT",
      options: {
        create: question.options.map((option, index) => ({
          id: option.id,
          label: option.label,
          text: option.text,
          matchKey: option.matchKey,
          sortOrder: index,
        })),
      },
    },
  });
}

await prisma.test.create({ data: { id: "qa-test", title: "sentinel", kind: "PRACTICE" } });
await prisma.testAttempt.create({ data: { id: "qa-attempt", testId: "qa-test" } });
await prisma.answer.create({
  data: { id: "qa-answer", attemptId: "qa-attempt", questionId: questions[0].id, userAnswer: "sentinel" },
});
await prisma.mistake.create({
  data: {
    id: "qa-mistake",
    subjectId: questions[0].subjectId,
    topicId: questions[0].topicId,
    questionId: questions[0].id,
    prompt: "sentinel",
    userAnswer: "sentinel",
    correctAnswer: "sentinel",
    explanation: "sentinel",
  },
});
await prisma.reviewSchedule.create({
  data: { id: "qa-review", topicId: questions[0].topicId, dueKey: "2026-10-28", intervalDays: 1 },
});

async function activity() {
  return {
    answer: await prisma.answer.count(),
    testAttempt: await prisma.testAttempt.count(),
    mistake: await prisma.mistake.count(),
    reviewSchedule: await prisma.reviewSchedule.count(),
  };
}
const activityBefore = await activity();

for (const question of questions) {
  await prisma.question.update({
    where: { id: question.id },
    data: {
      prompt: question.prompt,
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      verificationStatus: "DRAFT",
    },
  });
  await prisma.questionOption.deleteMany({ where: { questionId: question.id } });
  await prisma.questionOption.createMany({
    data: question.options.map((option, index) => ({
      id: option.id,
      questionId: question.id,
      label: option.label,
      text: option.text,
      matchKey: option.matchKey,
      sortOrder: index,
    })),
  });
}
const activityAfter = await activity();

const errors: string[] = [];
const ids = questions.map((question) => question.id);
if (new Set(ids).size !== 84) errors.push("unique ids");
const prompts = new Set<string>();
const allowed = new Set(["SINGLE_CHOICE", "MATCHING", "SEQUENCE", "NUMERIC", "SHORT_TEXT", "STEP_BY_STEP"]);
for (const question of questions) {
  if (question.verificationStatus !== "DRAFT") errors.push(`${question.id} status`);
  if (!allowed.has(question.type)) errors.push(`${question.id} type`);
  const promptKey = question.prompt.trim().toLowerCase();
  if (prompts.has(promptKey)) errors.push(`${question.id} duplicate prompt`);
  prompts.add(promptKey);
  const optionTexts = question.options.map((option) => option.text.trim().toLowerCase());
  if (new Set(optionTexts).size !== optionTexts.length) errors.push(`${question.id} duplicate option`);
  let prepared;
  try {
    prepared = prepareQuestion(question, { preserveIds: true });
  } catch (error) {
    errors.push(`${question.id} prepare ${error instanceof Error ? error.message : error}`);
    continue;
  }
  if (question.type === "SINGLE_CHOICE") {
    const correct = question.options.filter((option) => option.id === question.correctAnswer);
    if (correct.length !== 1) errors.push(`${question.id} key count`);
    if (!gradeAnswer({ type: question.type, correctAnswer: prepared.correctAnswer, userAnswer: prepared.correctAnswer }).isCorrect) {
      errors.push(`${question.id} grade true`);
    }
    for (const option of question.options) {
      if (option.id === question.correctAnswer) continue;
      const graded = gradeAnswer({ type: question.type, correctAnswer: prepared.correctAnswer, userAnswer: option.id });
      if (graded.isCorrect !== false) errors.push(`${question.id} second key ${option.label}`);
    }
  } else {
    const expected = prepared.correctAnswer;
    const userAnswer = question.type === "NUMERIC"
      ? expected
      : question.type === "SHORT_TEXT"
        ? (expected.trim().startsWith("[") ? String(JSON.parse(expected)[0]) : expected.split("|")[0])
        : JSON.parse(expected);
    if (!gradeAnswer({ type: question.type, correctAnswer: expected, userAnswer }).isCorrect) errors.push(`${question.id} grade`);
    if (question.type === "SHORT_TEXT" && gradeAnswer({ type: question.type, correctAnswer: expected, userAnswer: "неприйнятна відповідь" }).isCorrect === true) {
      errors.push(`${question.id} short text accepts anything`);
    }
  }
}

const perTopic = [];
for (const topicId of topicIds) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { questions: true },
  });
  const readiness = lessonReadiness({ lessonJson: topic.lessonJson, questions: topic.questions, videos: [] });
  perTopic.push({ topicId, total: topic.questions.length, counts: readiness.counts, practice: readiness.practice, coverage: topic.coverage });
  if (topic.questions.length !== 12 || !readiness.practice || topic.coverage !== "DRAFT") errors.push(`${topicId} threshold`);
}

const start = html.indexOf('<script id="packet" type="application/json">');
const end = html.indexOf("</script>", start);
const embedded = JSON.parse(html.slice(start + '<script id="packet" type="application/json">'.length, end));
if (embedded.questions.length !== 84) errors.push("html count");
for (const question of questions) {
  const shown = embedded.questions.find((item: { id: string }) => item.id === question.id);
  if (!shown || shown.prompt !== question.prompt || shown.correctAnswer !== question.correctAnswer || shown.explanation !== question.explanation || shown.contentHash !== question.contentHash) {
    errors.push(`${question.id} html mismatch`);
  }
}
if (!html.includes("contentHash !== question.contentHash")) errors.push("import hash check missing");
if (!html.includes("appliedToDatabase: false")) errors.push("export flag missing");
if (html.includes("nmt-stage6b1-owner-decisions")) errors.push("old storage key referenced");

const draftCount = await prisma.question.count({ where: { verificationStatus: "DRAFT" } });
if (draftCount !== 84) errors.push("draft count");
const verifiedCount = await prisma.question.count({ where: { verificationStatus: "VERIFIED" } });
if (verifiedCount !== 0) errors.push("verified appeared");

const after = statSync(workingDb);
const report = {
  isolatedDatabase: database,
  questions: 84,
  uniqueIds: new Set(ids).size,
  draftCount,
  verifiedCount,
  perTopic,
  activityBefore,
  activityAfter,
  activityUnchanged: JSON.stringify(activityBefore) === JSON.stringify(activityAfter),
  htmlMatchesManifest: !errors.some((error) => error.includes("html")),
  errors,
  workingSqliteUnchanged: after.size === before.size && after.mtimeMs === before.mtimeMs,
  subjectCorrectnessNotClaimed: true,
};
writeFileSync(path.join(process.cwd(), "content/stage6b/stage6b2-qa.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await prisma.$disconnect();
if (errors.length || !report.activityUnchanged || !report.workingSqliteUnchanged) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
