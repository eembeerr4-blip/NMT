import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { parseContentPackage } from "@/lib/content-package";
import { gradeAnswer } from "@/lib/grade";
import { lessonAccess, lessonReadiness } from "@/lib/readiness";
import { hashPasswordAsync } from "@/lib/auth";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE } from "@/lib/constants";

const auth = vi.hoisted(() => ({ id: "owner" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage8-batch02-"));
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
const directory = path.resolve("content/stage8/batch02");
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
    writeFileSync(path.join(metadata, "batch02-qa-location.json"), JSON.stringify({ database, folder, synthetic: true }));
  } else {
    const resolved = path.resolve(folder);
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("nmt-stage8-batch02-")) {
      throw new Error("Refusing to remove a directory outside this test's temporary namespace");
    }
    rmSync(resolved, { recursive: true, force: true });
  }
});


it("validates both new modules with the real package parser", () => {
  expect(packages).toHaveLength(1);
  const parsed = parseContentPackage(packages[0].raw);
  expect(parsed.report.errors).toEqual([]);
  const lessons = parsed.package!.sections.flatMap(s => s.topics);
  expect(lessons).toHaveLength(2);
  expect(lessons.flatMap(t => t.questions)).toHaveLength(24);
  for (const t of lessons) { expect(t.lesson.theory.length).toBeGreaterThan(1200); expect(t.lesson.examples).toHaveLength(3); }
});
const questions = parseContentPackage(packages[0].raw).package!.sections.flatMap(s => s.topics).flatMap(t => t.questions);
it.each(questions)("checks correct and incorrect grading for $code", q => {
  const answer = q.type === "MATCHING" ? JSON.parse(q.correctAnswer) : q.correctAnswer;
  expect(gradeAnswer({ type:q.type, correctAnswer:q.correctAnswer, userAnswer:answer }).isCorrect).toBe(true);
  expect(gradeAnswer({ type:q.type, correctAnswer:q.correctAnswer, userAnswer:"wrong" }).isCorrect).not.toBe(true);
  if(q.type === "SINGLE_CHOICE") for(const o of q.options) expect(gradeAnswer({type:q.type,correctAnswer:q.correctAnswer,userAnswer:o.label}).isCorrect).toBe(o.label===q.correctAnswer);
});
it("previews without writing, imports DRAFT and blocks student launch", async () => {
  expect((await previewContentPackage(packages[0].raw)).ok).toBe(true);
  expect(await prisma.topic.count()).toBe(0);
  expect((await importContentPackage(packages[0].raw)).ok).toBe(true);
  expect(await prisma.question.count({where:{verificationStatus:"DRAFT"}})).toBe(24);
  auth.id="stage8-student";
  for(const id of topics) { const topic = await prisma.topic.findUniqueOrThrow({where:{id},include:{questions:true}}); expect(lessonAccess(topic).available).toBe(false); expect(await startTopicTest(id)).toMatchObject({ok:false}); }
  expect(await prisma.testAttempt.count()).toBe(0);
  expect(await prisma.test.count()).toBe(0);
  expect(await prisma.userTopicProgress.count()).toBe(0);
});
it("verifies and publishes only synthetic QA lessons through existing gates", async () => {
  auth.id="owner";
  for(const q of await prisma.question.findMany()) expect(await verifyQuestion(q.id,"VERIFIED")).toMatchObject({ok:true});
  for(const id of topics) { const topic = await prisma.topic.findUniqueOrThrow({where:{id},include:{questions:true,children:true,videos:true}}); expect(lessonReadiness(topic).ready).toBe(true); expect(await publishLesson(id)).toMatchObject({ok:true}); }
});
it.each(topics)("completes real action cycle with matching and reload persistence for %s", async id => {
  auth.id="stage8-student";
  await expect(startTopicTest(id)).rejects.toThrow("REDIRECT:/tests/");
  const a=await prisma.testAttempt.findFirstOrThrow({where:{userId:auth.id,test:{topicId:id}},include:{test:{include:{questions:{include:{question:true}}}}}});
  expect(a.test.questions.filter(x=>x.question.type==="MATCHING")).toHaveLength(1);
  const answers=Object.fromEntries(a.test.questions.map(({question:q},i)=>[q.id,i===0?"wrong":q.type==="MATCHING"?JSON.parse(q.correctAnswer):q.correctAnswer]));
  expect(await saveDraft(a.id,answers,1)).toMatchObject({ok:true});
  expect(JSON.parse((await prisma.testAttempt.findUniqueOrThrow({where:{id:a.id}})).draftJson)).toEqual(answers);
  expect(await finishAttempt(a.id,answers)).toMatchObject({ok:true});
  expect(await prisma.testAttempt.findUniqueOrThrow({where:{id:a.id}})).toMatchObject({status:"COMPLETED",totalCount:12,correctCount:11});
  expect(await prisma.mistake.count({where:{userId:auth.id,topicId:id}})).toBe(1);
  expect(await prisma.reviewSchedule.count({where:{userId:auth.id,topicId:id}})).toBe(3);
});
it("repeat import preserves published QA content, attempts and answers", async () => {
  auth.id="owner"; const before=await prisma.question.findMany({include:{options:true},orderBy:{id:"asc"}});
  const r=await importContentPackage(packages[0].raw);expect(r.ok).toBe(true);if(r.ok)expect(r.report.counts).toMatchObject({topicsToCreate:0,topicsToUpdate:0,questionsToCreate:0,questionsToUpdate:0});
  expect(await prisma.question.findMany({include:{options:true},orderBy:{id:"asc"}})).toEqual(before);expect(await prisma.testAttempt.count()).toBe(2);expect(await prisma.answer.count()).toBe(24);
});
