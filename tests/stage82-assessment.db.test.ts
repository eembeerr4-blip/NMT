import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseContentPackage, type ContentPackage } from "@/lib/content-package";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE } from "@/lib/constants";
import { lessonAccess, lessonReadiness } from "@/lib/readiness";

const auth = vi.hoisted(() => ({ id: "owner" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage82-assessment-"));
  const database = path.join(folder, "qa.db");
  return { prisma: new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") + "?connection_limit=1" }), database, folder };
});
vi.mock("@/server/session", () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: auth.id }, include: { subjects: true } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); }, notFound: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { importContentPackage, publishLesson } from "@/server/content-import";
import { completeLesson, finishAttempt, gradeManually, saveDraft, startDiagnostic, startExam, startTopicTest, updateTopic, verifyQuestion } from "@/server/actions";
import { cloneTestSet, saveTestSet, setTestPublication, startPublishedTestSet } from "@/server/test-sets";
import { ASSESSMENT_INTERVAL_MS, hasIndependentMastery, trainingQuestionWhere } from "@/server/assessment";
import { ownedRetryQuestion, publicRetryQuestion, retryMistake } from "@/server/mistake-retry";

type Question = ContentPackage["sections"][number]["topics"][number]["questions"][number];
const bank = JSON.parse(readFileSync("content/stage8/validation81/math-expressions-assessment-bank.json", "utf8")) as { questions: Question[]; final: { questionIds: string[] }; delayed: { questionIds: string[] } };
const candidatePath = "content/stage8/validation82/packages/math-reviewed.package.json";
const topicId = "stage82-synthetic-expressions";
const otherTopic = "stage82-other-topic";
const sets: Record<string, string> = {};
const fixtureLesson = JSON.stringify({ objectives: ["Synthetic fixture"], theory: "Синтетична навчальна тема для перевірки серверних правил. ".repeat(20), rules: ["Fixture"], mistakes: ["Fixture"], summary: "Fixture", examples: [{ task: "1+1", solution: "2" }, { task: "2+2", solution: "4" }] });

async function answersFor(testId: string, wrong = 0) {
  const rows = await prisma.testQuestion.findMany({ where: { testId }, include: { question: true }, orderBy: { sortOrder: "asc" } });
  return Object.fromEntries(rows.map(({ question: q }, i) => [q.id, i < wrong ? "wrong" : ["MATCHING", "SEQUENCE"].includes(q.type) ? JSON.parse(q.correctAnswer) : q.correctAnswer]));
}
async function launch(id: string) {
  const result = await startPublishedTestSet(id);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok || !result.id) throw new Error("Launch failed");
  return result.id;
}
async function finish(id: string, wrong = 0) {
  const attempt = await prisma.testAttempt.findUniqueOrThrow({ where: { id } });
  expect(await finishAttempt(id, await answersFor(attempt.testId, wrong))).toMatchObject({ ok: true });
}
async function oldFinal(id: string, age = ASSESSMENT_INTERVAL_MS) {
  const finishedAt = new Date(Date.now() - age);
  await prisma.testAttempt.update({ where: { id }, data: { startedAt: new Date(finishedAt.getTime() - 60000), finishedAt } });
}
async function progress(userId: string) {
  return prisma.userTopicProgress.findUnique({ where: { userId_topicId: { userId, topicId } } });
}

beforeAll(async () => {
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  expect(database).toContain("nmt-stage82-assessment-");
  expect(path.isAbsolute(database)).toBe(true);
  expect(path.resolve(database)).not.toBe(path.resolve("prisma/dev.db"));
  writeFileSync(database, "", { flag: "wx" });
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: "file:" + database.replaceAll("\\", "/") }, stdio: "pipe", timeout: 60000 });
  await prisma.subject.create({ data: { id: "math", name: "Synthetic math", shortName: "Math", description: "Synthetic QA", color: "#123456", sortOrder: 0 } });
  for (const id of ["owner", "student", "boundary", "historical", "other", "race-same", "race-different", "failed-delayed", "failed", "manual", "pending", "scope"]) {
    await prisma.user.create({ data: { id, nickname: id, firstName: "Synthetic QA", role: id === "owner" ? "OWNER" : "STUDENT", accountStatus: id === "pending" ? "PENDING" : "APPROVED", onboarded: true } });
    await prisma.userSettings.create({ data: { id, userId: id, scheduleJson: JSON.stringify(DEFAULT_SCHEDULE), formatJson: JSON.stringify(DEFAULT_FORMAT) } });
    await prisma.userSubject.create({ data: { userId: id, subjectId: "math", active: true, role: "required" } });
  }
  // Existing available synthetic lesson; never the imported pilot. No pilot
  // coverage, difficulty or readiness value is overwritten to enable this QA.
  for (const id of [topicId, otherTopic]) await prisma.topic.create({ data: { id, subjectId: "math", title: "Synthetic existing lesson", sortOrder: 0, coverage: "VERIFIED", lessonJson: fixtureLesson } });
  for (let i = 0; i < 12; i++) await prisma.question.create({ data: { id: "s82-training-" + i, subjectId: "math", topicId, type: "NUMERIC", difficulty: "EASY", prompt: `Синтетична QA-вправа: ${i}+1`, correctAnswer: String(i + 1), explanation: `${i}+1=${i + 1}`, verificationStatus: "VERIFIED", source: "Synthetic test fixture, not publication content" } });
  for (const q of bank.questions) {
    const options = q.options.map((o, i) => ({ id: q.code + "-" + o.label, label: o.label, text: o.text, sortOrder: i }));
    await prisma.question.create({ data: { id: q.code, subjectId: "math", topicId, type: q.type, difficulty: q.difficulty, prompt: q.prompt, explanation: q.explanation, correctAnswer: q.type === "SINGLE_CHOICE" ? options.find(o => o.label === q.correctAnswer)!.id : q.correctAnswer, source: q.source, verificationStatus: "VERIFIED", options: { create: options } } });
  }
  for (const [name, ids] of [["final", bank.final.questionIds], ["delayed", bank.delayed.questionIds]] as const) {
    const result = await saveTestSet({ title: "Synthetic " + name, subjectId: "math", timeLimitMin: 0, questionIds: [...ids], assessmentPurpose: name === "final" ? "FINAL" : "DELAYED" });
    expect(result.ok, JSON.stringify(result)).toBe(true); if (!result.ok || !result.id) throw new Error("Set creation failed");
    sets[name] = result.id;
    expect(await setTestPublication(result.id, "PUBLISHED")).toMatchObject({ ok: true });
  }
}, 60000);

beforeEach(() => { auth.id = "owner"; });
afterAll(async () => {
  await prisma.$disconnect();
  const { folder } = await import("@/lib/prisma") as unknown as { folder: string };
  // Only the directory returned by this fixture's mkdtemp is removed.
  expect(path.basename(folder)).toMatch(/^nmt-stage82-assessment-/);
  rmSync(folder, { recursive: true, force: true });
});

it("imports the pilot as DRAFT and preserves all twelve independent answer keys", async () => {
  const parsed = parseContentPackage(readFileSync(candidatePath, "utf8"));
  expect(parsed.report.errors).toEqual([]);
  const pkg = parsed.package!;
  pkg.sections[0].topics = pkg.sections[0].topics.filter(t => t.code === "math-expressions");
  pkg.sections[0].code = "s82-pilot-section";
  expect((await importContentPackage(JSON.stringify(pkg))).ok).toBe(true);
  expect(await prisma.question.count({ where: { topicId: "math-expressions" } })).toBe(12);
  for (const q of await prisma.question.findMany({ where: { topicId: "math-expressions" } })) expect(await verifyQuestion(q.id, "VERIFIED")).toMatchObject({ ok: true });
});

it("keeps the pilot BLOCKED at the unchanged 4/5/3 gate, without overriding coverage", async () => {
  const topic = await prisma.topic.findUniqueOrThrow({ where: { id: "math-expressions" }, include: { questions: true, children: true, videos: true } });
  expect(lessonReadiness(topic)).toMatchObject({ counts: { EASY: 9, MEDIUM: 3, HARD: 0 }, ready: false });
  expect(await publishLesson(topic.id)).toMatchObject({ ok: false, error: expect.stringContaining("4/5/3") });
  expect((await prisma.topic.findUniqueOrThrow({ where: { id: topic.id } })).coverage).toBe("DRAFT");
  auth.id = "student";
  expect(await startTopicTest(topic.id)).toMatchObject({ ok: false });
  expect(await prisma.testAttempt.count({ where: { test: { topicId: topic.id } } })).toBe(0);
});

it("preserves OWNER/STUDENT, approval and active-subject launch restrictions", async () => {
  auth.id = "student";
  expect(await saveTestSet({ title: "No", subjectId: "math", timeLimitMin: 0, questionIds: bank.final.questionIds, assessmentPurpose: "FINAL" })).toMatchObject({ ok: false });
  expect(await setTestPublication(sets.final, "ARCHIVED")).toMatchObject({ ok: false });
  auth.id = "pending";
  expect(await startPublishedTestSet(sets.final)).toMatchObject({ ok: false });
  auth.id = "scope";
  await prisma.userSubject.updateMany({ where: { userId: auth.id }, data: { active: false } });
  expect(await startPublishedTestSet(sets.final)).toMatchObject({ ok: false });
  await prisma.userSubject.updateMany({ where: { userId: auth.id }, data: { active: true } });
});

it("rejects training/control overlap, mixed-topic controls and invalid purposes", async () => {
  expect(await saveTestSet({ title: "Leak", subjectId: "math", timeLimitMin: 0, questionIds: bank.final.questionIds })).toMatchObject({ ok: false });
  expect(await saveTestSet({ title: "Overlap", subjectId: "math", timeLimitMin: 0, questionIds: bank.final.questionIds, assessmentPurpose: "DELAYED" })).toMatchObject({ ok: false });
  await prisma.question.create({ data: { id: "other-q", subjectId: "math", topicId: otherTopic, type: "NUMERIC", difficulty: "EASY", prompt: "1+2", correctAnswer: "3", explanation: "1+2=3", verificationStatus: "VERIFIED" } });
  expect(await saveTestSet({ title: "Mixed", subjectId: "math", timeLimitMin: 0, questionIds: ["other-q", ...bank.final.questionIds], assessmentPurpose: "FINAL" })).toMatchObject({ ok: false });
  expect(await saveTestSet({ title: "Invalid", subjectId: "math", timeLimitMin: 0, questionIds: ["other-q"], assessmentPurpose: "EXAM" as "FINAL" })).toMatchObject({ ok: false });
});

it("excludes control questions from topic practice, diagnostics and ordinary exams", async () => {
  auth.id = "student";
  await expect(startTopicTest(topicId)).rejects.toThrow("REDIRECT:/tests/");
  await expect(startDiagnostic()).rejects.toThrow("REDIRECT:/tests/");
  await expect(startExam({ subjectId: "math", title: "QA exposure audit", count: 60, minutes: null })).rejects.toThrow("REDIRECT:/tests/");
  const attempts = await prisma.testAttempt.findMany({ where: { userId: auth.id }, include: { test: { include: { questions: true } } } });
  expect(attempts).toHaveLength(3);
  const controls = [...bank.final.questionIds, ...bank.delayed.questionIds];
  for (const a of attempts) expect(a.test.questions.every(q => !controls.includes(q.questionId))).toBe(true);
  expect(attempts.find(a => a.test.kind === "EXAM")!.test.questions.length).toBe(13);
});

it("reserves archived/draft banks and refuses moving previously trained questions into controls", async () => {
  await setTestPublication(sets.final, "ARCHIVED");
  expect(await prisma.question.count({ where: { id: { in: bank.final.questionIds }, ...trainingQuestionWhere } })).toBe(0);
  await setTestPublication(sets.final, "DRAFT");
  expect(await prisma.question.count({ where: { id: { in: bank.final.questionIds }, ...trainingQuestionWhere } })).toBe(0);
  await setTestPublication(sets.final, "PUBLISHED");
  expect(await saveTestSet({ title: "Already trained", subjectId: "math", timeLimitMin: 0, questionIds: ["s82-training-0"], assessmentPurpose: "FINAL" })).toMatchObject({ ok: false });
});

it("saves practice results and does not award MASTERED after one perfect training attempt", async () => {
  auth.id = "student";
  const a = await prisma.testAttempt.findFirstOrThrow({ where: { userId: auth.id, test: { kind: "TOPIC" } } });
  await finish(a.id);
  expect(await completeLesson(topicId, true)).toMatchObject({ ok: true });
  expect((await progress(auth.id))?.status).not.toBe("MASTERED");
  expect(await prisma.answer.count({ where: { attemptId: a.id } })).toBe(12);
});

it("finishes a genuine final, persists its draft/results and creates mistake/review records", async () => {
  auth.id = "student";
  const id = await launch(sets.final);
  const answers = await answersFor(sets.final, 1);
  expect(await saveDraft(id, answers, 2)).toMatchObject({ ok: true });
  expect(JSON.parse((await prisma.testAttempt.findUniqueOrThrow({ where: { id } })).draftJson)).toEqual(answers);
  expect(await finishAttempt(id, answers)).toMatchObject({ ok: true });
  expect(await prisma.testAttempt.findUniqueOrThrow({ where: { id } })).toMatchObject({ correctCount: 5, totalCount: 6, pendingCount: 0, status: "COMPLETED" });
  expect((await progress(auth.id))?.status).not.toBe("MASTERED");
  expect(await prisma.mistake.count({ where: { userId: auth.id, topicId } })).toBe(1);
  expect(await prisma.reviewSchedule.count({ where: { userId: auth.id, topicId } })).toBeGreaterThan(0);
  expect(await finishAttempt(id, answers)).toMatchObject({ ok: true });
  expect(await prisma.answer.count({ where: { attemptId: id } })).toBe(6);
});

it("blocks repeat finals, including another set with the same topic and purpose", async () => {
  const cloned = await cloneTestSet(sets.final);
  expect(cloned.ok).toBe(true); if (!cloned.ok || !cloned.id) throw new Error("Clone failed");
  sets.clonedFinal = cloned.id;
  await setTestPublication(cloned.id, "PUBLISHED");
  auth.id = "student";
  expect(await startPublishedTestSet(sets.final)).toMatchObject({ ok: false });
  expect(await startPublishedTestSet(cloned.id)).toMatchObject({ ok: false });
  expect(await prisma.testAttempt.count({ where: { userId: auth.id, test: { topicId, kind: "FINAL" } } })).toBe(1);
});

it("blocks delayed admission just before seven full days and permits the exact boundary", async () => {
  auth.id = "boundary";
  const first = await launch(sets.final);
  await finish(first, 1);
  const a = await prisma.testAttempt.findUniqueOrThrow({ where: { id: first } });
  expect(await startPublishedTestSet(sets.delayed)).toMatchObject({ ok: false });
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(a.finishedAt!.getTime() + ASSESSMENT_INTERVAL_MS - 1));
    expect(await startPublishedTestSet(sets.delayed)).toMatchObject({ ok: false });
    vi.setSystemTime(new Date(a.finishedAt!.getTime() + ASSESSMENT_INTERVAL_MS));
    const id = await launch(sets.delayed);
    await finish(id, 1);
    expect((await progress(auth.id))?.status).toBe("MASTERED");
    expect(await hasIndependentMastery(prisma, auth.id, topicId)).toBe(true);
    expect(await startPublishedTestSet(sets.delayed)).toMatchObject({ ok: false });
  } finally { vi.useRealTimers(); }
});

it("supports owned mistake correction without permitting access to another user's data", async () => {
  auth.id = "student";
  const mistake = await prisma.mistake.findFirstOrThrow({ where: { userId: auth.id, topicId } });
  const owned = await ownedRetryQuestion(prisma, auth.id, mistake.id);
  const revision = publicRetryQuestion(owned.question!).revision;
  const input = { mistakeId: mistake.id, requestId: "s82-retry", revision, answer: owned.question!.correctAnswer };
  expect(await retryMistake(prisma, auth.id, input)).toMatchObject({ isCorrect: true });
  expect((await prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } })).status).toBe("FIXED");
  await expect(retryMistake(prisma, "other", { ...input, requestId: "foreign" })).rejects.toThrow();
  auth.id = "other";
  const a = await prisma.testAttempt.findFirstOrThrow({ where: { userId: "student", testId: sets.final } });
  expect(await finishAttempt(a.id, {})).toMatchObject({ ok: false });
});

it.each(["same", "different"])("atomically allows only one of simultaneous FINAL requests (%s sets)", async mode => {
  auth.id = "race-" + mode;
  const results = await Promise.all([startPublishedTestSet(sets.final), startPublishedTestSet(mode === "same" ? sets.final : sets.clonedFinal)]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
  expect(results.filter(r => !r.ok)).toHaveLength(1);
  expect(await prisma.testAttempt.count({ where: { userId: auth.id, test: { topicId, kind: "FINAL" } } })).toBe(1);
});

it("scopes evidence to the specific user and topic", async () => {
  auth.id = "other";
  expect(await startPublishedTestSet(sets.delayed)).toMatchObject({ ok: false });
  expect(await hasIndependentMastery(prisma, auth.id, topicId)).toBe(false);
  expect(await hasIndependentMastery(prisma, "student", otherTopic)).toBe(false);
  const id = await launch(sets.final);
  await finish(id);
  expect((await progress(auth.id))?.status).not.toBe("MASTERED");
});

it("rejects 4/6 finals as delayed prerequisites, even after seven days", async () => {
  auth.id = "failed";
  const id = await launch(sets.final);
  await finish(id, 2);
  await oldFinal(id);
  expect(await startPublishedTestSet(sets.delayed)).toMatchObject({ ok: false });
  expect((await progress(auth.id))?.status).not.toBe("MASTERED");
});

it("does not award MASTERED when the delayed form scores only 4/6", async () => {
  auth.id = "failed-delayed";
  const first = await launch(sets.final);
  await finish(first, 1);
  await oldFinal(first);
  const later = await launch(sets.delayed);
  await finish(later, 2);
  expect((await progress(auth.id))?.status).not.toBe("MASTERED");
  expect(await hasIndependentMastery(prisma, auth.id, topicId)).toBe(false);
});

it("keeps manual grading pending and starts the seven-day interval only after successful grading", async () => {
  // A separate original manual-control bank, never reusing the automatic bank.
  for (const purpose of ["FINAL", "DELAYED"] as const) {
    const id = "s82-manual-" + purpose;
    await prisma.question.create({ data: { id, subjectId: "math", topicId, type: "STEP_BY_STEP", difficulty: "MEDIUM", prompt: "Синтетична ручна перевірка", correctAnswer: "2", explanation: "1+1=2", verificationStatus: "VERIFIED" } });
    const r = await saveTestSet({ title: "Manual " + purpose, subjectId: "math", timeLimitMin: 0, questionIds: [id], assessmentPurpose: purpose });
    expect(r.ok).toBe(true); if (!r.ok || !r.id) throw new Error("Manual set failed");
    sets["manual-" + purpose] = r.id; await setTestPublication(r.id, "PUBLISHED");
  }
  auth.id = "manual";
  const id = await launch(sets["manual-FINAL"]);
  expect(await finishAttempt(id, { "s82-manual-FINAL": "Пояснення словами" })).toMatchObject({ ok: true });
  await oldFinal(id);
  expect(await startPublishedTestSet(sets["manual-DELAYED"])).toMatchObject({ ok: false });
  expect((await progress(auth.id))?.status).not.toBe("MASTERED");
  const answer = await prisma.answer.findFirstOrThrow({ where: { attemptId: id } });
  expect(await gradeManually(answer.id, true)).toMatchObject({ ok: true });
  expect(await gradeManually(answer.id, true)).toMatchObject({ ok: false });
  expect(await startPublishedTestSet(sets["manual-DELAYED"])).toMatchObject({ ok: false });
  await oldFinal(id);
  const delayed = await launch(sets["manual-DELAYED"]);
  expect(await finishAttempt(delayed, { "s82-manual-DELAYED": "Пояснення словами" })).toMatchObject({ ok: true });
  expect((await progress(auth.id))?.status).not.toBe("MASTERED");
  const later = await prisma.answer.findFirstOrThrow({ where: { attemptId: delayed } });
  expect(await gradeManually(later.id, true)).toMatchObject({ ok: true });
  expect((await progress(auth.id))?.status).toBe("MASTERED");
});

it("does not let content editors assign MASTERED without independent evidence", async () => {
  expect(await updateTopic({ id: topicId, title: "Synthetic existing lesson", summary: "", formulas: "", status: "MASTERED" })).toMatchObject({ ok: false });
  expect((await progress("owner"))?.status).not.toBe("MASTERED");
});

it("rejects historical overlap as mastery evidence and excludes controls from publication practice counts", async () => {
  auth.id = "historical";
  const first = await launch(sets.final);
  await finish(first, 1);
  await oldFinal(first);
  const delayed = await launch(sets.delayed);
  await finish(delayed, 1);
  expect(await hasIndependentMastery(prisma, auth.id, topicId)).toBe(true);
  // Simulate an old pre-fix exposure; do not weaken the current launch guard.
  const legacy = await prisma.test.create({ data: { title: "Pre-fix historical exposure", kind: "TOPIC", subjectId: "math", topicId, questions: { create: { questionId: bank.final.questionIds[0], sortOrder: 0 } } } });
  await prisma.testAttempt.create({ data: { testId: legacy.id, userId: auth.id } });
  expect(await hasIndependentMastery(prisma, auth.id, topicId)).toBe(false);
  expect(await prisma.question.count({ where: { topicId, ...trainingQuestionWhere } })).toBe(12);
  const topic = await prisma.topic.findUniqueOrThrow({ where: { id: topicId }, include: { questions: { where: trainingQuestionWhere }, videos: true } });
  expect(lessonAccess(topic).available).toBe(true);
  expect(lessonReadiness(topic).counts).toEqual({ EASY: 12, MEDIUM: 0, HARD: 0 });
  expect(await prisma.auditLog.count({ where: { action: "LESSON_PUBLISHED" } })).toBe(0);
});
