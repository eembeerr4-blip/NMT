import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const auth = vi.hoisted(() => ({ user: { id: "qa-student", role: "STUDENT", accountStatus: "APPROVED", subjects: [{ subjectId: "qa-subject", active: true }] } as { id: string; role: string; accountStatus: string; subjects: { subjectId: string; active: boolean }[] } | null }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-topic-access-"));
  const database = path.join(folder, "qa.db");
  return { prisma: new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") + "?connection_limit=1" }), folder, database };
});
vi.mock("@/server/session", () => ({ getSessionUser: () => auth.user, createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
import { prisma } from "@/lib/prisma";
import { startTopicTest, startDiagnostic, startExam, saveDraft, finishAttempt, gradeManually, completeLesson } from "@/server/actions";
import { requireAccessibleAttempt } from "@/server/test-access";
import { startPublishedTestSet } from "@/server/test-sets";
vi.mock("@/server/sync", async importOriginal => ({
  ...await importOriginal<typeof import("@/server/sync")>(),
  getSettings: async () => ({ format: { officialFormatConfirmed: false }, masteryHighMin: 10, masteryMidMin: 7 }),
  rebuildFuturePlan: vi.fn(),
}));

beforeAll(async () => {
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  const sql = new DatabaseSync(database);
  // Build only the required empty fixture tables from checked-in CREATE definitions.
  // No migration, db push, seed, or access to the application's DATABASE_URL.
  const initial = readFileSync("prisma/migrations/20261017083146_init/migration.sql", "utf8");
  const reconcile = readFileSync("prisma/migrations/20261018000000_reconcile_history/migration.sql", "utf8");
  const definition = (source: string, name: string) => {
    const ddl = source.match(new RegExp('CREATE TABLE "' + name + '" \\([\\s\\S]*?\\n\\);'))?.[0];
    if (!ddl) throw new Error("Missing fixture table " + name);
    return ddl;
  };
  sql.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY); CREATE TABLE "Subject" (id TEXT PRIMARY KEY);');
  sql.exec(definition(reconcile, "new_Topic").replace('"new_Topic"', '"Topic"'));
  for (const table of ["Question", "QuestionOption", "Test", "TestQuestion", "TestAttempt", "Answer", "StudySession", "Mistake", "ReviewSchedule", "StudyTask"]) sql.exec(definition(initial, table));
  for (const table of ["TestAttempt", "StudySession", "Mistake", "ReviewSchedule", "StudyTask"]) sql.exec('ALTER TABLE "' + table + '" ADD COLUMN "userId" TEXT;');
  sql.exec(definition(reconcile, "UserTopicProgress"));
  sql.exec('CREATE UNIQUE INDEX progress_identity ON UserTopicProgress(userId,topicId);');
  sql.exec("INSERT INTO User VALUES ('qa-student'); INSERT INTO Subject VALUES ('qa-subject');");
  sql.close();
});
beforeEach(async () => {
  auth.user = { id: "qa-student", role: "STUDENT", accountStatus: "APPROVED", subjects: [{ subjectId: "qa-subject", active: true }] };
  await prisma.answer.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.mistake.deleteMany();
  await prisma.reviewSchedule.deleteMany();
  await prisma.testAttempt.deleteMany();
  await prisma.testQuestion.deleteMany();
  await prisma.test.deleteMany();
  await prisma.userTopicProgress.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
});
afterAll(async () => {
  await prisma.$disconnect();
  const { folder } = await import("@/lib/prisma") as unknown as { folder: string };
  rmSync(folder, { recursive: true });
});
const counts = async () => [await prisma.test.count(), await prisma.testAttempt.count(), await prisma.userTopicProgress.count()];
async function fixture(coverage: string, verificationStatus: string) {
  await prisma.topic.create({ data: { id: "qa-topic", subjectId: "qa-subject", title: "QA topic", sortOrder: 0, coverage, lessonJson: "" } });
  await prisma.question.create({ data: { id: "qa-question", topicId: "qa-topic", subjectId: "qa-subject", type: "NUMERIC", difficulty: "EASY", prompt: "QA 1+1", explanation: "QA", correctAnswer: "2", verificationStatus } });
}
it.each([
  ["DRAFT", "VERIFIED"],
  ["DRAFT", "DRAFT"],
  ["READY", "DRAFT"],
])("blocks %s topic / %s questions without writes", async (coverage, status) => {
  await fixture(coverage, status);
  const before = await counts();
  expect(await startTopicTest("qa-topic")).toMatchObject({ ok: false });
  expect(await counts()).toEqual(before);
});
it("blocks a missing topic without writes", async () => {
  const before = await counts();
  expect(await startTopicTest("missing")).toMatchObject({ ok: false });
  expect(await counts()).toEqual(before);
});
it.each(["READY", "PARTIAL"])("preserves practice-only published %s topics", async coverage => {
  await fixture(coverage, "VERIFIED");
  await expect(startTopicTest("qa-topic")).rejects.toThrow("REDIRECT:/tests/");
  expect(await counts()).toEqual([1, 1, 1]);
  expect(await prisma.testQuestion.findFirst()).toMatchObject({ questionId: "qa-question" });
});
it.each(["EDITOR", "ADMIN", "OWNER"])("does not treat %s editorial preview as permission to attempt a DRAFT", async role => {
  auth.user!.role = role;
  await fixture("DRAFT", "VERIFIED");
  expect(await startTopicTest("qa-topic")).toMatchObject({ ok: false });
  expect(await counts()).toEqual([0, 0, 0]);
});
it("still requires authentication", async () => {
  await fixture("READY", "VERIFIED");
  auth.user = null;
  await expect(startTopicTest("qa-topic")).rejects.toThrow();
  expect(await counts()).toEqual([0, 0, 0]);
});

const launch = (kind: string) => kind === "diagnostic" ? startDiagnostic() : startExam({ subjectId: "qa-subject", title: "QA exam", count: 3, minutes: null });
for (const kind of ["diagnostic", "exam"]) {
  it.each([["DRAFT", "VERIFIED"], ["DRAFT", "DRAFT"], ["READY", "DRAFT"]])(`${kind} excludes %s / %s without writes`, async (coverage, status) => {
    await fixture(coverage, status);
    expect(await launch(kind)).toMatchObject({ ok: false });
    expect(await counts()).toEqual([0, 0, 0]);
  });
  it(`${kind} rejects unattached VERIFIED questions`, async () => {
    await fixture("READY", "VERIFIED");
    await prisma.question.update({ where: { id: "qa-question" }, data: { topicId: null } });
    expect(await launch(kind)).toMatchObject({ ok: false });
    expect(await counts()).toEqual([0, 0, 0]);
  });
  it(`${kind} works with published questions and records an honest shortfall`, async () => {
    await fixture("READY", "VERIFIED");
    await expect(launch(kind)).rejects.toThrow("REDIRECT:/tests/");
    expect(await counts()).toEqual([1, 1, 0]);
    const test = await prisma.test.findFirstOrThrow({ include: { questions: true } });
    expect(test.questions.map(q => q.questionId)).toEqual(["qa-question"]);
    expect(JSON.parse(test.configJson).shortfall).toBe(2);
  });
}
async function attemptFixture(status = "IN_PROGRESS", kind = "EXAM") {
  await fixture("READY", "VERIFIED");
  const test = await prisma.test.create({ data: { title: "QA test", kind, subjectId: "qa-subject", configJson: '{"publication":"PUBLISHED"}', questions: { create: { questionId: "qa-question", sortOrder: 0 } } } });
  return prisma.testAttempt.create({ data: { testId: test.id, userId: "qa-student", status } });
}
it("blocks a mixed published test set before creating an attempt", async () => {
  const attempt = await attemptFixture();
  await prisma.testAttempt.delete({ where: { id: attempt.id } });
  await prisma.topic.update({ where: { id: "qa-topic" }, data: { coverage: "DRAFT" } });
  const before = await counts();
  expect(await startPublishedTestSet(attempt.testId)).toMatchObject({ ok: false });
  expect(await counts()).toEqual(before);
});
it("does not resume an old diagnostic containing hidden questions", async () => {
  const attempt = await attemptFixture("IN_PROGRESS", "DIAGNOSTIC");
  await prisma.topic.update({ where: { id: "qa-topic" }, data: { coverage: "DRAFT" } });
  const before = await counts();
  expect(await startDiagnostic()).toMatchObject({ ok: false });
  expect(await counts()).toEqual(before);
  expect(await prisma.testAttempt.findUnique({ where: { id: attempt.id } })).toBeTruthy();
});
it.each(["IN_PROGRESS", "COMPLETED"])("hides %s history after unpublication without deleting it", async status => {
  const attempt = await attemptFixture(status);
  await prisma.topic.update({ where: { id: "qa-topic" }, data: { coverage: "DRAFT" } });
  const before = await prisma.testAttempt.findUnique({ where: { id: attempt.id } });
  await expect(requireAccessibleAttempt(attempt.id, "qa-student")).rejects.toThrow();
  expect(await saveDraft(attempt.id, { "qa-question": "2" }, 0)).toMatchObject({ ok: false });
  expect(await finishAttempt(attempt.id, { "qa-question": "2" })).toMatchObject({ ok: false });
  expect(await prisma.testAttempt.findUnique({ where: { id: attempt.id } })).toEqual(before);
  expect(await prisma.answer.count()).toBe(0);
});
it("rejects a foreign or missing attempt for read/save/finish", async () => {
  const attempt = await attemptFixture();
  for (const id of [attempt.id, "missing"]) {
    await expect(requireAccessibleAttempt(id, "other-user")).rejects.toThrow();
  }
  auth.user!.id = "other-user";
  expect(await saveDraft(attempt.id, {}, 0)).toMatchObject({ ok: false });
  expect(await finishAttempt(attempt.id, {})).toMatchObject({ ok: false });
  expect(await prisma.testAttempt.findUnique({ where: { id: attempt.id } })).toEqual(attempt);
});
it("blocks an attempt when a question is unverified or detached", async () => {
  const attempt = await attemptFixture();
  for (const data of [{ verificationStatus: "DRAFT" }, { verificationStatus: "VERIFIED", topicId: null }]) {
    await prisma.question.update({ where: { id: "qa-question" }, data });
    await expect(requireAccessibleAttempt(attempt.id, "qa-student")).rejects.toThrow();
    expect(await saveDraft(attempt.id, {}, 0)).toMatchObject({ ok: false });
    expect(await finishAttempt(attempt.id, {})).toMatchObject({ ok: false });
  }
  expect(await prisma.testAttempt.findUnique({ where: { id: attempt.id } })).toEqual(attempt);
});
it("preserves published save/finish/review and prevents hidden manual grading", async () => {
  const attempt = await attemptFixture();
  expect(await saveDraft(attempt.id, { "qa-question": "2" }, 0)).toMatchObject({ ok: true });
  expect(await finishAttempt(attempt.id, { "qa-question": "2" })).toMatchObject({ ok: true });
  const result = await requireAccessibleAttempt(attempt.id, "qa-student");
  expect(result).toMatchObject({ status: "COMPLETED", correctCount: 1, totalCount: 1, percent: 100 });
  const answer = await prisma.answer.findFirstOrThrow();
  await prisma.topic.update({ where: { id: "qa-topic" }, data: { coverage: "DRAFT" } });
  expect(await gradeManually(answer.id, false)).toMatchObject({ ok: false });
  expect(await prisma.answer.findUnique({ where: { id: answer.id } })).toEqual(answer);
  expect(await prisma.testAttempt.findUnique({ where: { id: attempt.id } })).toMatchObject({ status: "COMPLETED", correctCount: 1 });
});

it("does not complete a hidden lesson via historical results", async () => {
  const attempt = await attemptFixture("COMPLETED");
  await prisma.topic.update({ where: { id: "qa-topic" }, data: { coverage: "DRAFT" } });
  expect(await completeLesson("qa-topic", true)).toMatchObject({ ok: false });
  expect(await prisma.testAttempt.findUnique({ where: { id: attempt.id } })).toEqual(attempt);
  expect(await prisma.userTopicProgress.count()).toBe(0);
  expect(await prisma.studySession.count()).toBe(0);
});
for (const kind of ["diagnostic", "exam"]) {
  it(`${kind} selects only published questions from a mixed bank`, async () => {
    await fixture("READY", "VERIFIED");
    await prisma.topic.create({ data: { id: "hidden-topic", subjectId: "qa-subject", title: "Hidden", sortOrder: 1, coverage: "DRAFT" } });
    await prisma.question.createMany({ data: [
      { id: "hidden-q", topicId: "hidden-topic", verificationStatus: "VERIFIED" },
      { id: "unverified-q", topicId: "qa-topic", verificationStatus: "DRAFT" },
      { id: "unattached-q", topicId: null, verificationStatus: "VERIFIED" },
    ].map(row => ({ ...row, subjectId: "qa-subject", type: "NUMERIC", difficulty: "EASY", prompt: row.id, explanation: "QA", correctAnswer: "2" })) });
    await expect(launch(kind)).rejects.toThrow("REDIRECT:/tests/");
    const rows = await prisma.testQuestion.findMany();
    expect(rows.map(row => row.questionId)).toEqual(["qa-question"]);
  });
}

it("still starts a published test set with accessible questions", async () => {
  const attempt = await attemptFixture();
  await prisma.testAttempt.delete({ where: { id: attempt.id } });
  expect(await startPublishedTestSet(attempt.testId)).toMatchObject({ ok: true });
  expect(await counts()).toEqual([1, 1, 0]);
});
