import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: undefined }));
vi.mock("@/server/session", () => ({ getSessionUser: vi.fn() }));
import { syncPlanWithClient } from "@/server/sync";

const folder = mkdtempSync(path.join(tmpdir(), "nmt-sync-provenance-"));
const database = path.join(folder, "qa.db");
const url = "file:" + database.replaceAll("\\", "/") + "?connection_limit=1";
const db = new PrismaClient({ datasourceUrl: url });
const schedule = { anchorMockDate: "2026-10-24", rotation: ["math"], days: { "1": [{ slot: 0, kind: "study", subjectId: "math", title: "QA", durationMin: 20 }] } };

beforeAll(async () => {
  writeFileSync(database, "");
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", timeout: 60000 });
  await db.subject.create({ data: { id: "math", name: "QA math", shortName: "QA", description: "QA", color: "blue", sortOrder: 0 } });
  for (const id of ["learner", "other"]) {
    await db.user.create({ data: { id, nickname: id, firstName: "QA" } });
    await db.userSettings.create({ data: { id, userId: id, planStart: "2026-10-26", dailyMinutes: 100, formatJson: "{}", studyDaysJson: "[0,1,2,3,4,5,6]", scheduleJson: JSON.stringify(schedule) } });
  }
}, 60000);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
  await db.studyTask.deleteMany();
});

afterAll(async () => {
  vi.useRealTimers();
  await db.$disconnect();
  rmSync(folder, { recursive: true });
});

it("keeps the moved source slot across four consecutive synchronizations", async () => {
  const counts: number[] = [];
  for (let run = 0; run < 4; run++) {
    await syncPlanWithClient("learner", db);
    counts.push(await db.studyTask.count({ where: { userId: "learner" } }));
  }
  console.log("QA sync counts:", counts);
  expect(counts).toEqual(Array(4).fill(counts[0]));
  const source = await db.studyTask.findFirstOrThrow({ where: { userId: "learner", dateKey: "2026-10-26", templateKey: "d1-s0" } });
  expect(source.status).toBe("MOVED");
  const successor = await db.studyTask.findFirstOrThrow({ where: { userId: "learner", movedFromId: source.id } });
  expect(successor.dateKey).toBe("2026-10-27");
  expect(successor.templateKey).toBe(`moved-${source.id}`);
  expect(await db.studyTask.count({ where: { movedFromId: source.id } })).toBe(1);
});

it("preserves DONE, custom and manually moved records and other users", async () => {
  await db.studyTask.createMany({ data: [
    { id: "done", userId: "learner", dateKey: "2026-10-26", templateKey: "d1-s0", kind: "study", title: "Done", durationMin: 20, status: "DONE" },
    { id: "custom", userId: "learner", dateKey: "2026-10-26", templateKey: "custom-qa", kind: "custom", title: "Personal", durationMin: 10 },
    { id: "manual", userId: "learner", dateKey: "2026-10-26", templateKey: "moved-qa", movedFromId: "original", kind: "study", title: "Moved", durationMin: 10 },
    { id: "other-task", userId: "other", dateKey: "2026-10-26", templateKey: "d1-s0", kind: "study", title: "Other", durationMin: 20 },
  ] });
  const ids = ["done", "custom", "manual", "other-task"];
  const before = await db.studyTask.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
  for (let run = 0; run < 3; run++) await syncPlanWithClient("learner", db);
  expect(await db.studyTask.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } })).toEqual(before);
  expect(await db.studyTask.count({ where: { userId: "learner", dateKey: "2026-10-26", templateKey: "d1-s0" } })).toBe(1);
});

it("also preserves provenance when sync uses an existing transaction client", async () => {
  for (let run = 0; run < 3; run++) await db.$transaction(tx => syncPlanWithClient("learner", tx));
  expect(await db.studyTask.count({ where: { userId: "learner" } })).toBe(8);
  expect(await db.studyTask.count({ where: { userId: "learner", status: "MOVED" } })).toBe(1);
});

it("rolls back the source marker when the successor cannot be created", async () => {
  await db.studyTask.createMany({ data: [
    { id: "source", userId: "learner", dateKey: "2026-10-26", templateKey: "d1-s0", kind: "study", title: "Original", durationMin: 20 },
    { id: "conflict", userId: "learner", dateKey: "2026-10-27", templateKey: "moved-source", movedFromId: "source", kind: "study", title: "Existing", durationMin: 20, status: "SKIPPED" },
  ] });
  await expect(syncPlanWithClient("learner", db)).rejects.toMatchObject({ code: "P2002" });
  expect(await db.studyTask.findUniqueOrThrow({ where: { id: "source" } })).toMatchObject({ status: "PLANNED", dateKey: "2026-10-26" });
  expect(await db.studyTask.count({ where: { movedFromId: "source" } })).toBe(1);
});

it("counts completed work against the daily limit when shifting overdue work", async () => {
  await db.studyTask.create({ data: { id: "today-done", userId: "learner", dateKey: "2026-10-27", templateKey: "custom-done", kind: "custom", title: "Completed", durationMin: 100, status: "DONE" } });
  await syncPlanWithClient("learner", db);
  const source = await db.studyTask.findFirstOrThrow({ where: { userId: "learner", dateKey: "2026-10-26", templateKey: "d1-s0" } });
  const moved = await db.studyTask.findFirstOrThrow({ where: { movedFromId: source.id } });
  expect(moved.dateKey).toBe("2026-10-28");
  const today = await db.studyTask.findMany({ where: { userId: "learner", dateKey: "2026-10-27", status: { in: ["PLANNED", "IN_PROGRESS", "DONE"] } } });
  expect(today.reduce((sum, task) => sum + task.durationMin, 0)).toBeLessThanOrEqual(100);
});
