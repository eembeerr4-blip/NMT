import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { parseContentPackage } from "@/lib/content-package";
import { loadMathContent } from "@/lib/math-content";
import { verifyMathContent } from "../scripts/verify-math-content";
import { gradeAnswer } from "@/lib/grade";
import { lessonAccess, lessonReadiness } from "@/lib/readiness";
import { hashPasswordAsync } from "@/lib/auth";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE } from "@/lib/constants";

const auth = vi.hoisted(() => ({ id: "owner" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage8-synthetic-"));
  const database = path.join(folder, "qa.db");
  return { prisma: new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") + "?connection_limit=1" }), folder, database };
});
vi.mock("@/server/session", () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: auth.id }, include: { subjects: true } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); }, notFound: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { importContentPackage, previewContentPackage, publishLesson } from "@/server/content-import";
import { finishAttempt, saveDraft, startTopicTest, verifyQuestion } from "@/server/actions";
const directory = path.resolve("content/stage8/packages");
const packages = readdirSync(directory).filter(n => n.endsWith(".package.json")).map(n => ({ name: n, raw: readFileSync(path.join(directory, n), "utf8") }));
const topics = packages.flatMap(p => JSON.parse(p.raw).sections.flatMap((s: { topics: { code: string }[] }) => s.topics.map(t => t.code))) as string[];

beforeAll(async () => {
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  expect(path.resolve(database)).not.toBe(path.resolve("prisma/dev.db"));
  writeFileSync(database, "", { flag: "wx" });
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: "file:" + database.replaceAll("\\", "/") }, stdio: "pipe", timeout: 60000 });
  for (const id of ["math", "ukrainian", "history", "biology"]) await prisma.subject.create({ data: { id, name: id, shortName: id, description: "Synthetic Stage 8 QA", color: "#123456", sortOrder: 0 } });
  const password = randomBytes(32).toString("hex");
  const passwordHash = await hashPasswordAsync(password);
  for (const [id, role] of [["owner", "OWNER"], ["stage8-student", "STUDENT"]]) {
    await prisma.user.create({ data: { id, nickname: id, firstName: "Synthetic QA", role, accountStatus: "APPROVED", onboarded: true, passwordHash, emailVerifiedAt: new Date() } });
    await prisma.userSettings.create({ data: { id, userId: id, scheduleJson: JSON.stringify(DEFAULT_SCHEDULE), formatJson: JSON.stringify(DEFAULT_FORMAT) } });
    for (const subjectId of ["math", "ukrainian", "history", "biology"]) await prisma.userSubject.create({ data: { userId: id, subjectId, active: true, role: subjectId === "biology" ? "elective" : "required" } });
  }
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  const { database, folder } = await import("@/lib/prisma") as unknown as { database: string; folder: string };
  if (process.env.STAGE8_RETAIN_QA === "1") {
    const metadata = path.join(tmpdir(), "nmt-stage8-content");
    mkdirSync(metadata, { recursive: true });
    writeFileSync(path.join(metadata, "qa-location.json"), JSON.stringify({ database, folder, synthetic: true }));
  } else {
    const resolved = path.resolve(folder);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("nmt-stage8-synthetic-")) {
      throw new Error("Refusing to remove a directory outside this test's temporary namespace");
    }
    rmSync(resolved, { recursive: true, force: true });
  }
});

it("independently recomputes all 120 math keys, 30 matching pairs and example proofs", () => {
  const result = verifyMathContent(loadMathContent(path.resolve("content/stage8/math-draft-reviewed.v2.json")));
  expect(result.questions).toBe(120);
  expect(result.topics).toBe(10);
});
it.each(packages)("validates $name with the actual package parser", ({ raw }) => {
  const parsed = parseContentPackage(raw);
  expect(parsed.report.errors).toEqual([]);
  expect(parsed.package).not.toBeNull();
});
it("preserves all mathematics keys and corrects only the three substantiated question fields", () => {
  const old = loadMathContent(), next = loadMathContent(path.resolve("content/stage8/math-draft-reviewed.v2.json"));
  const changed: string[] = [];
  old.packs.forEach((p, i) => p.questions.forEach((q, j) => {
    const updated = next.packs[i].questions[j];
    expect(updated.correctAnswer).toBe(q.correctAnswer);
    for (const field of ["id", "topicId", "subjectId", "type", "difficulty", "options"] as const) expect(updated[field]).toEqual(q[field]);
    for (const field of ["prompt", "explanation"] as const) if (q[field] !== updated[field]) changed.push(q.id + ":" + field);
  }));
  expect(changed.sort()).toEqual(["math-draft-v1-math-probability-09:explanation", "math-draft-v1-math-solid-05:prompt", "math-draft-v1-math-solid-08:prompt"]);
});
it("preserves all 19 existing example answerCheck keys with their original task and solution", () => {
  const guards = JSON.parse(readFileSync("content/stage8/math-current-preconditions.json", "utf8")) as { topics: {topicId:string;examples:{index:number;task:string;solution:string;answerCheck:unknown}[]}[] };
  const pkg = parseContentPackage(readFileSync("content/stage8/packages/math-reviewed.package.json", "utf8")).package!;
  let preserved = 0;
  for (const g of guards.topics) for (const e of g.examples) {
    const actual = pkg.sections.flatMap(s => s.topics).find(t => t.code === g.topicId)!.lesson.examples[e.index];
    expect(actual.task).toBe(e.task); expect(actual.solution).toBe(e.solution);
    expect(actual.answerCheck ?? null).toEqual(e.answerCheck);
    if (e.answerCheck) preserved++;
  }
  expect(preserved).toBe(19);
});
it("all 156 keys grade correctly, wrong answers fail, and each choice has a unique label/text", () => {
  for (const { raw } of packages) {
    const pkg = parseContentPackage(raw).package!;
    for (const topic of pkg.sections.flatMap(s => s.topics)) for (const q of topic.questions) {
      expect(new Set(q.options.map(o => o.label)).size).toBe(q.options.length);
      if (q.type === "SINGLE_CHOICE") expect(new Set(q.options.map(o => o.text)).size).toBe(q.options.length);
      const key = ["MATCHING", "SEQUENCE"].includes(q.type) ? JSON.parse(q.correctAnswer) : q.correctAnswer;
      expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: key }).isCorrect, q.code).toBe(true);
      expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: "wrong" }).isCorrect, q.code).not.toBe(true);
    }
  }
});
it("imports four packages through authenticated actions only as DRAFT, previews without writing", async () => {
  for (const p of packages) {
    const before = await prisma.topic.count();
    expect((await previewContentPackage(p.raw)).ok, p.name).toBe(true);
    expect(await prisma.topic.count()).toBe(before);
    const result = await importContentPackage(p.raw);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  }
  expect(await prisma.topic.count({ where: { id: { in: topics }, coverage: "DRAFT" } })).toBe(13);
  expect(await prisma.question.count({ where: { verificationStatus: "DRAFT" } })).toBe(156);
  expect(await prisma.auditLog.count({ where: { action: "CONTENT_IMPORTED" } })).toBe(4);
}, 30000);
it("student cannot launch any draft topic and cannot import", async () => {
  auth.id = "stage8-student";
  for (const id of topics) {
    const topic = await prisma.topic.findUniqueOrThrow({ where: { id }, include: { questions: true } });
    expect(lessonAccess(topic).available).toBe(false);
    expect(await startTopicTest(id)).toMatchObject({ ok: false });
  }
  expect((await importContentPackage(packages[0].raw)).ok).toBe(false);
  expect(await prisma.test.count()).toBe(0);
  expect(await prisma.testAttempt.count()).toBe(0);
  expect(await prisma.userTopicProgress.count()).toBe(0);
});
it("only in the synthetic database verifies questions and publishes 13 modules through existing gates", async () => {
  auth.id = "owner";
  for (const q of await prisma.question.findMany()) expect(await verifyQuestion(q.id, "VERIFIED")).toMatchObject({ ok: true });
  for (const id of topics) {
    const topic = await prisma.topic.findUniqueOrThrow({ where: { id }, include: { questions: true, children: true, videos: true } });
    expect(lessonReadiness(topic).ready, id).toBe(true);
    expect(await publishLesson(id), id).toMatchObject({ ok: true });
  }
}, 30000);
it.each(topics)("full real server-action learning cycle for %s preserves results and schedules review", async id => {
  auth.id = "stage8-student";
  await expect(startTopicTest(id)).rejects.toThrow("REDIRECT:/tests/");
  const attempt = await prisma.testAttempt.findFirstOrThrow({ where: { userId: auth.id, test: { topicId: id } }, include: { test: { include: { questions: { include: { question: true } } } } } });
  const answers = Object.fromEntries(attempt.test.questions.map(({ question: q }, i) => [q.id, i === 0 ? "wrong" : ["MATCHING", "SEQUENCE"].includes(q.type) ? JSON.parse(q.correctAnswer) : q.correctAnswer]));
  expect(await saveDraft(attempt.id, answers, 1)).toMatchObject({ ok: true });
  expect(JSON.parse((await prisma.testAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).draftJson)).toEqual(answers);
  expect(await finishAttempt(attempt.id, answers)).toMatchObject({ ok: true });
  const result = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { answers: true } });
  expect(result).toMatchObject({ status: "COMPLETED", totalCount: 12, correctCount: 11, pendingCount: 0 });
  expect(result.answers).toHaveLength(12);
  expect(await prisma.mistake.count({ where: { userId: auth.id, topicId: id } })).toBe(1);
  expect(await prisma.reviewSchedule.count({ where: { userId: auth.id, topicId: id, status: "PENDING" } })).toBe(3);
  expect(await finishAttempt(attempt.id, answers)).toMatchObject({ ok: true });
  expect(await prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(12);
});
it("repeated imports skip all protected lessons and preserve completed attempts", async () => {
  auth.id = "owner";
  const before = await prisma.question.findMany({ include: { options: true }, orderBy: { id: "asc" } });
  for (const p of packages) {
    const result = await importContentPackage(p.raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.counts).toMatchObject({ topicsToCreate: 0, topicsToUpdate: 0, questionsToCreate: 0, questionsToUpdate: 0 });
  }
  expect(await prisma.question.findMany({ include: { options: true }, orderBy: { id: "asc" } })).toEqual(before);
  expect(await prisma.testAttempt.count({ where: { status: "COMPLETED" } })).toBe(13);
});
