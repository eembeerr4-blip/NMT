import { beforeEach, expect, it, vi } from "vitest";
import { dateKey, addDateKeys } from "@/lib/dates";
const mock = vi.hoisted(() => ({
  user: { id: "learner-A", subjects: [{ active: true, subjectId: "biology" }] },
  settings: { planStart: "2026-10-19", targetScore: 150, examDate: null },
  sync: vi.fn(),
  db: { studyTask: { count: vi.fn(), findMany: vi.fn() }, topic: { findMany: vi.fn() }, subject: { findMany: vi.fn() }, userTopicProgress: { findMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mock.db }));
vi.mock("@/server/session", () => ({ requireUser: async () => mock.user }));
vi.mock("@/server/sync", () => ({ syncPlan: mock.sync, getSettings: async () => mock.settings }));
vi.mock("@/components/task-controls", () => ({ TaskControls: () => null }));
import Curriculum from "@/app/(main)/curriculum/page";
const snapshot = (node: unknown) => JSON.stringify(node, (key, value) => ["type", "_owner", "_store"].includes(key) ? undefined : value);
beforeEach(() => {
  vi.clearAllMocks();
  mock.settings.planStart = dateKey();
  mock.db.studyTask.count.mockResolvedValue(0);
  for (const model of [mock.db.studyTask, mock.db.topic, mock.db.subject, mock.db.userTopicProgress]) model.findMany.mockResolvedValue([]);
});

it("keeps sync and personal scope, honest empty state and all three URL modes", async () => {
  const page = snapshot(await Curriculum({ searchParams: Promise.resolve({}) }));
  expect(mock.sync).toHaveBeenCalledWith("learner-A");
  expect(mock.db.studyTask.count).toHaveBeenCalledWith({ where: { userId: "learner-A", dateKey: { gte: dateKey() } } });
  expect(page).toContain("За цими умовами занять немає");
  for (const mode of ["personal", "free", "materials"]) expect(page).toContain(`"mode":"${mode}"`);
});

it("paginates every saved task with stable ordering, and preserves historical filters", async () => {
  mock.db.studyTask.count.mockResolvedValue(31);
  mock.db.studyTask.findMany.mockResolvedValue([{ id: "task-A" }]);
  const page = snapshot(await Curriculum({ searchParams: Promise.resolve({ period: "all", status: "MOVED", page: "2" }) }));
  const where = { userId: "learner-A", status: "MOVED" };
  expect(mock.db.studyTask.count).toHaveBeenCalledWith({ where });
  expect(mock.db.studyTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 12, take: 12, orderBy: [{ dateKey: "asc" }, { sortOrder: "asc" }, { id: "asc" }] }));
  expect(page).toContain('"period":"all"');
  expect(page).toContain('"status":"MOVED"');
});

it("clamps stale pages, ignores unknown status values and retains a real future plan start", async () => {
  mock.settings.planStart = addDateKeys(dateKey(), 10);
  const page = snapshot(await Curriculum({ searchParams: Promise.resolve({ page: "9999", status: "__proto__", mode: "bogus" }) }));
  expect(mock.db.studyTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, where: { userId: "learner-A", dateKey: { gte: mock.settings.planStart } } }));
  expect(page).toContain("План починається");
});

it("retains free library and material readiness without treating editorial completion as learner mastery", async () => {
  const free = snapshot(await Curriculum({ searchParams: Promise.resolve({ mode: "free" }) }));
  expect(free).toContain("Вільне навчання");
  const materials = snapshot(await Curriculum({ searchParams: Promise.resolve({ mode: "materials" }) }));
  expect(materials).toContain("Готовність навчальних матеріалів");
  expect(materials).toContain("Оберіть предмети");
  expect(mock.sync).not.toHaveBeenCalled();
  expect(mock.db.topic.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { subjectId: { in: ["biology"] } } }));
});
