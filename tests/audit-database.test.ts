import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ id: "owner" }));
vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn(async () => ({ id: auth.id, onboarded: true })),
  createSession: vi.fn(), clearSession: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { prisma } from "../src/lib/prisma";
import { buildBackup, restoreBackup, saveVideoNotes, saveVideoPosition, importQuestions, deleteQuestion, verifyQuestion, saveQuestion, reportQuestion } from "../src/server/actions";
import { GET as exportResults } from "../src/app/api/export/results/route";

describe.skipIf(process.env.NMT_AUDIT_DB !== "1")("isolated audit database export and restoration", () => {
  beforeAll(() => {
    if (process.env.DATABASE_URL !== "file:./audit-20261017.e2e.db") throw new Error("This audit must use only the disposable audit database");
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it("exports only the current learner's CSV results", async () => {
    const learner = await prisma.user.findUniqueOrThrow({ where: { nickname: "audit_second_1017" } });
    auth.id = learner.id;
    const response = await exportResults();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("nmt-results.csv");
    const csv = await response.text();
    expect(csv).toContain("Аудит: пробник математики");
    expect(csv).toContain("160");
    expect(csv).not.toContain("Результат 30 вересня");
    expect(csv.split("\n")).toHaveLength(2);
    auth.id = "owner";
  });

  it("restores accounts, subject choices and personal progress without losing them", async () => {
    auth.id = "owner";
    const snapshot = await buildBackup();
    expect(snapshot.version).toBe(5);
    expect(snapshot.users.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.progress.length).toBeGreaterThan(0);
    expect(snapshot.userSubjects.length).toBeGreaterThanOrEqual(8);
    const extraResults = await prisma.examResult.count();
    await prisma.examResult.create({ data: { userId: "owner", subjectId: "math", date: new Date("2026-10-20"), testType: "MANUAL", title: "Temporary restore probe", source: "QA", ratingScore: 150, belowThreshold: false, partial: false, countsTowardAverage: true, comment: "" } });
    const restored = await restoreBackup(JSON.stringify(snapshot), "ВІДНОВИТИ");
    expect(restored, JSON.stringify(restored)).toMatchObject({ ok: true });
    expect(await prisma.user.count()).toBe(snapshot.users.length);
    expect(await prisma.userSubject.count()).toBe(snapshot.userSubjects.length);
    expect(await prisma.userTopicProgress.count()).toBe(snapshot.progress.length);
    expect(await prisma.userVideoProgress.count()).toBe(snapshot.videoProgress.length);
    expect(await prisma.examResult.count()).toBe(snapshot.examResults.length);
    expect(await prisma.testAttempt.count()).toBe(snapshot.attempts.length);
    expect(await prisma.examResult.count({ where: { title: "Temporary restore probe" } })).toBe(0);
    expect(extraResults).toBeGreaterThanOrEqual(0);
  }, 20000);

  it("rejects incomplete old copies before changing any data", async () => {
    auth.id = "owner";
    const before = await prisma.examResult.count();
    expect((await restoreBackup(JSON.stringify({ version: 1, subjects: [], settings: [] }), "ВІДНОВИТИ")).ok).toBe(false);
    expect(await prisma.examResult.count()).toBe(before);
  });
  it("keeps each learner's video position and notes private", async()=>{
    const video=await prisma.videoLesson.findFirstOrThrow();
    const learner=await prisma.user.findUniqueOrThrow({where:{nickname:"audit_second_1017"}});
    auth.id="owner";expect((await saveVideoNotes(video.id,"Owner private note")).ok).toBe(true);expect((await saveVideoPosition(video.id,45)).ok).toBe(true);
    auth.id=learner.id;expect((await saveVideoNotes(video.id,"Learner private note")).ok).toBe(true);expect((await saveVideoPosition(video.id,90)).ok).toBe(true);
    const rows=await prisma.userVideoProgress.findMany({where:{videoId:video.id}});
    expect(rows.find(r=>r.userId==="owner")).toMatchObject({notes:"Owner private note",lastPositionSec:45});
    expect(rows.find(r=>r.userId===learner.id)).toMatchObject({notes:"Learner private note",lastPositionSec:90});auth.id="owner";
  });

  it("blocks learner edits and preserves verified questions when reporting issues", async()=>{
    const learner=await prisma.user.findUniqueOrThrow({where:{nickname:"audit_second_1017"}});auth.id=learner.id;
    const q=await prisma.question.findFirstOrThrow({where:{verificationStatus:"VERIFIED"}});
    expect((await deleteQuestion(q.id)).ok).toBe(false);expect((await verifyQuestion(q.id,"REJECTED")).ok).toBe(false);
    expect((await reportQuestion(q.id,"Audit proposal")).ok).toBe(true);
    expect((await prisma.question.findUniqueOrThrow({where:{id:q.id}})).verificationStatus).toBe("VERIFIED");auth.id="owner";
  });

  it("imports atomically, skips duplicates and keeps rejected questions in history", async()=>{
    auth.id="owner";
    const q={subjectId:"math",topicId:"math-linear-eq",type:"NUMERIC",difficulty:"EASY",prompt:"Audit atomic import "+Date.now(),explanation:"2+2=4",correctAnswer:"4",verificationStatus:"DRAFT",options:[]};
    const before=await prisma.question.count();
    expect((await importQuestions(JSON.stringify([q,{...q,prompt:q.prompt+" invalid",topicId:"missing-topic"}]))).ok).toBe(false);
    expect(await prisma.question.count()).toBe(before);
    expect((await importQuestions(JSON.stringify([q,q]))).ok).toBe(true);expect(await prisma.question.count()).toBe(before+1);
    const saved=await prisma.question.findFirstOrThrow({where:{prompt:q.prompt}});
    expect(saved.verificationStatus).toBe("PENDING_REVIEW");
    expect((await deleteQuestion(saved.id)).ok).toBe(true);expect(await prisma.question.findUnique({where:{id:saved.id}})).toMatchObject({verificationStatus:"REJECTED"});
  });

  it("rejects a question attached to a different subject",async()=>{
    auth.id="owner";const before=await prisma.question.count();
    expect((await saveQuestion({subjectId:"ukrainian",topicId:"math-linear-eq",type:"NUMERIC",difficulty:"EASY",prompt:"Audit mismatched topic",explanation:"4",correctAnswer:"4",verificationStatus:"DRAFT",options:[]})).ok).toBe(false);
    expect(await prisma.question.count()).toBe(before);
  });

});
