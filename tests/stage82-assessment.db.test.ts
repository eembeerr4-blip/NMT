import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { parseContentPackage, type ContentPackage } from "@/lib/content-package";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE } from "@/lib/constants";
import { hashPasswordAsync } from "@/lib/auth";
import { lessonReadiness } from "@/lib/readiness";

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
import { importContentPackage } from "@/server/content-import";
import { finishAttempt, saveDraft, startExam, verifyQuestion } from "@/server/actions";
import { saveTestSet, setTestPublication, startPublishedTestSet } from "@/server/test-sets";
type Question = ContentPackage["sections"][number]["topics"][number]["questions"][number];
const bank = JSON.parse(readFileSync("content/stage8/validation81/math-expressions-assessment-bank.json", "utf8")) as { questions: Question[]; final: { questionIds: string[] }; delayed: { questionIds: string[] } };
const candidatePath = "content/stage8/validation82/packages/math-reviewed.package.json";
const sets: Record<string, string> = {};
const findings: Record<string, unknown> = { productionLogicChanged: false, actualSevenDayWait: false };

beforeAll(async () => {
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  expect(database).toContain("nmt-stage82-assessment-");
  expect(path.resolve(database)).not.toBe(path.resolve("prisma/dev.db"));
  writeFileSync(database, "", { flag: "wx" });
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: "file:" + database.replaceAll("\\", "/") }, stdio: "pipe", timeout: 60000 });
  for (const id of ["math", "ukrainian", "history", "biology"]) await prisma.subject.create({ data: { id, name: id, shortName: id, description: "Synthetic QA", color: "#123456", sortOrder: 0 } });
  const passwordHash = await hashPasswordAsync(randomBytes(32).toString("hex"));
  for (const [id, role] of [["owner", "OWNER"], ["stage82-student", "STUDENT"], ["stage82-browser", "STUDENT"]]) {
    await prisma.user.create({ data: { id, nickname: id, firstName: "Synthetic QA", role, accountStatus: "APPROVED", onboarded: true, passwordHash, emailVerifiedAt: new Date() } });
    await prisma.userSettings.create({ data: { id, userId: id, scheduleJson: JSON.stringify(DEFAULT_SCHEDULE), formatJson: JSON.stringify(DEFAULT_FORMAT) } });
    await prisma.userSubject.create({ data: { userId: id, subjectId: "math", active: true, role: "required" } });
  }
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  writeFileSync(path.join(tmpdir(), "nmt-stage82-assessment-location.json"), JSON.stringify({ database, synthetic: true, sets, findings, candidatePath }));
});

it("imports only the revised pilot as DRAFT into a new synthetic fixture", async () => {
  const parsed = parseContentPackage(readFileSync(candidatePath, "utf8"));
  expect(parsed.report.errors).toEqual([]);
  const pkg = parsed.package!;
  pkg.sections[0].topics = pkg.sections[0].topics.filter(t => t.code === "math-expressions");
  pkg.sections[0].code = "s82-pilot-section";
  expect((await importContentPackage(JSON.stringify(pkg))).ok).toBe(true);
  expect(await prisma.question.count()).toBe(12);
  expect((await prisma.topic.findUniqueOrThrow({ where: { id: "math-expressions" } })).coverage).toBe("DRAFT");
});

it("honestly evaluates publication readiness and creates an explicit learner-availability fixture", async () => {
  for (const q of await prisma.question.findMany()) expect(await verifyQuestion(q.id, "VERIFIED")).toMatchObject({ ok: true });
  const topic = await prisma.topic.findUniqueOrThrow({ where: { id: "math-expressions" }, include: { questions: true, children: true, videos: true } });
  findings.publicationReadiness = lessonReadiness(topic);
  // Synthetic fixture state, NOT successful publication through the existing4/5/3gate.
  await prisma.topic.update({ where: { id: topic.id }, data: { coverage: "READY" } });
  for (const q of bank.questions) {
    const options = q.options.map((o, i) => ({ id: q.code + "-" + o.label, label: o.label, text: o.text, sortOrder: i }));
    await prisma.question.create({ data: { id: q.code, subjectId: "math", topicId: topic.id, type: q.type, difficulty: q.difficulty, prompt: q.prompt, explanation: q.explanation, correctAnswer: q.type === "SINGLE_CHOICE" ? options.find(o => o.label === q.correctAnswer)!.id : q.correctAnswer, source: q.source, verificationStatus: "DRAFT", options: { create: options } } });
    expect(await verifyQuestion(q.code, "VERIFIED")).toMatchObject({ ok: true });
  }
});

it("creates disjoint curated final/delayed sets through existing owner server actions", async () => {
  const practice = (await prisma.question.findMany({ where: { id: { notIn: bank.questions.map(q => q.code) } } })).map(q => q.id);
  for (const [name, ids] of [["practice", practice], ["final", bank.final.questionIds], ["delayed", bank.delayed.questionIds]] as const) {
    const result = await saveTestSet({ title: "Stage82 " + name, subjectId: "math", timeLimitMin: 0, questionIds: [...ids] });
    expect(result.ok).toBe(true); if (!result.ok || !result.id) throw new Error("Curated set creation failed"); sets[name] = result.id;
    expect(await setTestPublication(result.id!, "PUBLISHED")).toMatchObject({ ok: true });
  }
  expect(new Set([...practice, ...bank.final.questionIds, ...bank.delayed.questionIds]).size).toBe(24);
});

it("completes a genuine curated final attempt, persists6 answers and creates a mistake/review", async () => {
  auth.id = "stage82-student";
  const started = await startPublishedTestSet(sets.final); expect(started.ok).toBe(true); if (!started.ok || !started.id) throw new Error("Curated launch failed");
  const rows = await prisma.testQuestion.findMany({ where: { testId: sets.final }, include: { question: true }, orderBy: { sortOrder: "asc" } });
  const answers = Object.fromEntries(rows.map(({ question: q }, i) => [q.id, i === 0 ? "wrong" : q.correctAnswer]));
  expect(await saveDraft(started.id!, answers, 2)).toMatchObject({ ok: true });
  expect(JSON.parse((await prisma.testAttempt.findUniqueOrThrow({ where: { id: started.id } })).draftJson)).toEqual(answers);
  expect(await finishAttempt(started.id!, answers)).toMatchObject({ ok: true });
  expect(await prisma.testAttempt.findUniqueOrThrow({ where: { id: started.id } })).toMatchObject({ correctCount: 5, totalCount: 6, status: "COMPLETED" });
  expect(await prisma.answer.count({ where: { attemptId: started.id } })).toBe(6);
  expect(await prisma.mistake.count({ where: { userId: auth.id } })).toBe(1);
  expect(await prisma.reviewSchedule.count({ where: { userId: auth.id } })).toBeGreaterThan(0);
  findings.singleFinalProgressStatus = (await prisma.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: auth.id, topicId: "math-expressions" } } })).status;
  expect(await finishAttempt(started.id!, answers)).toMatchObject({ ok: true });
  expect(await prisma.answer.count({ where: { attemptId: started.id } })).toBe(6);
});

it("characterizes missing controls without calling them acceptance PASS", async () => {
  const reused = await startPublishedTestSet(sets.final);
  const early = await startPublishedTestSet(sets.delayed);
  findings.reuseGuard = { expected: "BLOCKED", actual: reused.ok ? "ALLOWED" : "BLOCKED", acceptance: reused.ok ? "FAIL" : "PASS" };
  findings.sevenDayGuard = { expected: "BLOCKED", actual: early.ok ? "ALLOWED" : "BLOCKED", acceptance: early.ok ? "FAIL" : "PASS" };
  await expect(startExam({ subjectId: "math", title: "QA exposure audit", count: 24, minutes: null })).rejects.toThrow("REDIRECT:/tests/");
  const exam = await prisma.test.findFirstOrThrow({ where: { title: "QA exposure audit" }, include: { questions: true } });
  const leaked = exam.questions.filter(q => bank.questions.some(b => b.code === q.questionId)).length;
  findings.practiceHoldoutIsolation = { expected: 0, actual: leaked, acceptance: leaked ? "FAIL" : "PASS" };
  expect(reused.ok).toBe(true); expect(early.ok).toBe(true); expect(leaked).toBe(12);
});
