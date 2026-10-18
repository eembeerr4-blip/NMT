import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  verifyOwnerPassword: vi.fn(),
  user: vi.fn(),
  xp: vi.fn(),
  sync: vi.fn(),
  rebuild: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    auditLog: { create: vi.fn() },
    flashcard: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    studySession: { create: vi.fn() },
    studyTask: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    testAttempt: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    note: { update: vi.fn(), delete: vi.fn() },
    reviewSchedule: { update: vi.fn() },
    mistake: { update: vi.fn() },
    userTopicProgress: { upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/auth", async () => ({
  ...await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth"),
  verifyPasswordAsync: mock.verifyOwnerPassword,
}));

vi.mock("@/lib/prisma", () => ({ prisma: mock.prisma }));
vi.mock("@/server/session", () => ({ getSessionUser: mock.user, createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/progress", () => ({ addXp: mock.xp, refreshAchievements: vi.fn() }));
vi.mock("@/server/sync", () => ({ getSettings: vi.fn(), syncPlan: mock.sync, rebuildFuturePlan: mock.rebuild }));

import { updateUserRole, buildBackup, completeOnboarding, completeReview, deleteNote, logStudyMinutes, recalculateFuturePlan, restoreBackup, reviewFlashcard, saveDraft, saveFlashcard, saveFormat, saveSchedule, setTaskStatus } from "./actions";
import { verifyPasswordAsync } from "@/lib/auth";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(verifyPasswordAsync).mockImplementation(async (password, stored) => password === "owner-confirmation" && stored === "owner-password-hash");
  mock.prisma.$transaction.mockImplementation(async callback=>callback(mock.prisma));
  mock.user.mockResolvedValue({ id: "learner-a", onboarded: true });
});

describe("personal learning data isolation", () => {
  it("saves a new flashcard under the signed-in learner", async () => {
    expect((await saveFlashcard({ front: "2x=8", back: "4", kind: "formula", topicId: "math-linear-eq" })).ok).toBe(true);
    expect(mock.prisma.flashcard.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "learner-a" }) }));
  });

  it("includes the learner when recording study minutes", async () => {
    await logStudyMinutes({ minutes: 12, topicId: "math-linear-eq" });
    expect(mock.prisma.studySession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "learner-a", durationMin: 12 }) }));
  });

  it("rejects updating another learner's draft", async () => {
    mock.prisma.testAttempt.updateMany.mockResolvedValue({count:0});
    expect((await saveDraft("other-attempt", { answer: "4" }, 2)).ok).toBe(false);
    expect(mock.prisma.testAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:"other-attempt",userId:"learner-a",status:"IN_PROGRESS"}}));
    expect(mock.prisma.testAttempt.update).not.toHaveBeenCalled();
  });

  it("constrains note deletion to the signed-in learner", async () => {
    await deleteNote("note-id");
    expect(mock.prisma.note.delete).toHaveBeenCalledWith({ where: { id: "note-id", userId: "learner-a" } });
  });

  it("does not allow another learner's flashcard to be reviewed", async () => {
    mock.prisma.flashcard.findUnique.mockResolvedValue(null);
    expect((await reviewFlashcard("other-card", "again")).ok).toBe(false);
    expect(mock.prisma.flashcard.findUnique).toHaveBeenCalledWith({ where: { id: "other-card", userId: "learner-a" } });
    expect(mock.prisma.flashcard.update).not.toHaveBeenCalled();
  });

  it("updates only personal topic progress after a difficult card", async () => {
    mock.prisma.flashcard.findUnique.mockResolvedValue({ id: "card", topicId: "math-linear-eq", userId: "learner-a" });
    await reviewFlashcard("card", "again");
    expect(mock.prisma.userTopicProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_topicId: { userId: "learner-a", topicId: "math-linear-eq" } } }));
  });

  it("recalculates the current learner's plan inside the same transaction", async () => {
    expect((await recalculateFuturePlan()).ok).toBe(true);
    expect(mock.rebuild).toHaveBeenCalledWith("learner-a",mock.prisma);
    expect(mock.prisma.$transaction).toHaveBeenCalled();
  });

  it("does not double count an already completed task", async () => {
    mock.prisma.studyTask.findUnique.mockResolvedValue({ id: "task", userId: "learner-a", status: "DONE" });
    expect((await setTaskStatus("task", "DONE")).ok).toBe(true);
    expect(mock.prisma.studyTask.update).not.toHaveBeenCalled();
    expect(mock.prisma.studySession.create).not.toHaveBeenCalled();
    expect(mock.xp).not.toHaveBeenCalled();
  });

  it("requires an owned pending review before awarding XP", async () => {
    mock.prisma.reviewSchedule.update.mockRejectedValue(new Error("Record not found"));
    expect((await completeReview("already-done-or-other")).ok).toBe(false);
    expect(mock.prisma.reviewSchedule.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "already-done-or-other", userId: "learner-a", status: "PENDING" } }));
    expect(mock.xp).not.toHaveBeenCalled();
  });

  it("blocks installation backups and restore for a regular learner", async () => {
    await expect(buildBackup()).rejects.toThrow("власнику");
    expect(await restoreBackup("{}", "ВІДНОВИТИ")).toEqual({ ok: false, error: "Ця дія доступна лише власнику платформи." });
  });

  it("blocks student edits to schedule and exam-format configuration", async () => {
    expect(await saveSchedule(JSON.stringify({ days: [], rotation: [], anchorMockDate: "2026-10-24" }))).toEqual({
      ok: false,
      error: "Ця дія доступна лише адміністратору платформи.",
    });
    expect(await saveFormat(JSON.stringify({ year: 2027, officialFormatConfirmed: false }))).toEqual({
      ok: false,
      error: "Ця дія доступна лише адміністратору платформи.",
    });
    expect(mock.prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns a useful error for a taken nickname before creating a user", async () => {
    mock.prisma.$queryRaw.mockResolvedValue([{ id: "existing-owner" }]);
    const result = await completeOnboarding({ firstName: "Учень", lastName: "", nickname: "owner", password: "test-pass", examYear: 2027, targetScore: 170, electiveId: "geography", intensity: "light", dailyMinutes: 75, preferredTime: "19:30", studyDays: [1, 3, 5] });
    expect(result).toEqual({ ok: false, error: "Цей нікнейм уже зайнятий." });
    expect(mock.prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("administrative role management",()=>{
 const owner={id:"owner",firstName:"Власник",role:"ADMIN",passwordHash:"owner-password-hash"};
 const learner={id:"other",firstName:"Учень",nickname:"other",role:"STUDENT"};
 function profiles(current:{id:string;firstName:string;role:string;passwordHash?:string}=owner,target:{id:string;firstName:string;nickname:string;role:string}=learner){mock.user.mockResolvedValue(current);mock.prisma.user.findUnique.mockImplementation(async ({where}:{where:{id:string}})=>where.id===current.id?current:where.id===target.id?target:null);}
 it("does not allow a learner to grant admin access",async()=>{
  expect((await updateUserRole("other","ADMIN")).ok).toBe(false);expect(mock.prisma.user.update).not.toHaveBeenCalled();expect(mock.prisma.auditLog.create).not.toHaveBeenCalled();
 });
 it("protects the owner from accidental demotion",async()=>{
  profiles();expect((await updateUserRole("owner","STUDENT")).ok).toBe(false);expect(mock.prisma.user.update).not.toHaveBeenCalled();
 });
 it("validates the role and records the exact member and previous role",async()=>{
  profiles();expect((await updateUserRole("other","UNKNOWN")).ok).toBe(false);expect(mock.prisma.user.update).not.toHaveBeenCalled();
  expect((await updateUserRole("other","EDITOR")).ok).toBe(true);expect(mock.prisma.user.update).toHaveBeenCalledWith({where:{id:"other"},data:{role:"EDITOR"}});
  expect(mock.prisma.auditLog.create).toHaveBeenCalledWith({data:expect.objectContaining({actorId:"owner",actorRole:"OWNER",action:"USER_ROLE_CHANGED",entityId:"other",metadataJson:JSON.stringify({role:"EDITOR",previousRole:"STUDENT"})})});
 });
 it("requires owner reauthentication and explicit target nickname before granting OWNER",async()=>{
  profiles();expect((await updateUserRole("other","OWNER")).ok).toBe(false);
  expect((await updateUserRole("other","OWNER",{password:"owner-confirmation",nickname:"different"})).ok).toBe(false);
  expect(mock.prisma.user.update).not.toHaveBeenCalled();
  expect((await updateUserRole("other","OWNER",{password:"owner-confirmation",nickname:"other"})).ok).toBe(true);
  expect(mock.prisma.user.update).toHaveBeenCalledWith({where:{id:"other"},data:{role:"OWNER"}});
 });
 it("denies an administrator attempting to grant owner or administrator access",async()=>{
  profiles({id:"admin",firstName:"Адмін",role:"ADMIN"});for(const role of ["OWNER","ADMIN"])expect((await updateUserRole("other",role)).ok).toBe(false);expect(mock.prisma.user.update).not.toHaveBeenCalled();
 });
 it("rechecks the acting profile inside the transaction instead of trusting an older session result",async()=>{
  profiles({id:"admin",firstName:"Адмін",role:"ADMIN"});mock.prisma.user.findUnique.mockImplementation(async ({where}:{where:{id:string}})=>where.id==="admin"?{id:"admin",role:"STUDENT"}:learner);
  expect((await updateUserRole("other","EDITOR")).ok).toBe(false);expect(mock.prisma.user.update).not.toHaveBeenCalled();expect(mock.prisma.auditLog.create).not.toHaveBeenCalled();
 });
 it("denies complete backups and restore to an administrator",async()=>{
  profiles({id:"admin",firstName:"Адмін",role:"ADMIN"});await expect(buildBackup()).rejects.toThrow("власнику");expect((await restoreBackup("{}","ВІДНОВИТИ")).ok).toBe(false);
 });
});
