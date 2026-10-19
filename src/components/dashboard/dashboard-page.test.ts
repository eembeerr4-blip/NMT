import { beforeEach, expect, it, vi } from "vitest";
import { addDateKeys, dateKey } from "@/lib/dates";

const mock = vi.hoisted(() => ({
  user: { id: "learner-A", firstName: "Учень", examYear: 2027, diagnosticSkipped: true, subjects: ["math", "ukrainian", "history", "biology"].map(subjectId => ({ subjectId, active: true })) },
  settings: { planStart: "2026-10-19", mathPriority: 35, ukrainianPriority: 25, historyPriority: 20, biologyPriority: 20 },
  sync: vi.fn(),
  db: { studyTask: { findMany: vi.fn(), findFirst: vi.fn() }, subject: { findMany: vi.fn() }, topic: { findMany: vi.fn() }, userTopicProgress: { findMany: vi.fn() }, examResult: { findMany: vi.fn() }, testAttempt: { count: vi.fn(), findFirst: vi.fn() }, mistake: { findMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mock.db }));
vi.mock("@/server/session", () => ({ requireUser: async () => mock.user }));
vi.mock("@/server/sync", () => ({ getSettings: async () => mock.settings, syncPlan: mock.sync }));
vi.mock("@/components/task-controls", () => ({ TaskControls: () => null }));
vi.mock("@/components/diagnostic-start", () => ({ DiagnosticStart: () => null }));
import DashboardPage from "@/app/(main)/page";

function pageSnapshot(node: unknown) {
  // Inspect rendered props/children, not React's cyclic component/owner metadata.
  return JSON.stringify(node, (key, value) => ["type", "_owner", "_store"].includes(key) ? undefined : value);
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.user.firstName = "Учень";
  mock.settings.planStart = dateKey();
  mock.db.studyTask.findMany.mockResolvedValue([]);
  mock.db.studyTask.findFirst.mockResolvedValue(null);
  mock.db.subject.findMany.mockResolvedValue([{ id: "math", name: "Математика" }, { id: "ukrainian", name: "Українська мова" }, { id: "history", name: "Історія України" }, { id: "biology", name: "Біологія" }]);
  for (const model of [mock.db.topic, mock.db.userTopicProgress, mock.db.examResult, mock.db.mistake]) model.findMany.mockResolvedValue([]);
  mock.db.testAttempt.count.mockResolvedValue(0);
});

it("renders honest no-content, no-task and no-mock states using only the signed-in learner", async () => {
  const page = pageSnapshot(await DashboardPage());
  expect(page).toContain("Матеріали готуються");
  expect(page).toContain("На цей день занять немає.");
  expect(page).toContain("Пробники ще не заплановано");
  expect(page).toContain("Біологія");
  expect(page).not.toContain("/learn/");
  expect(page).not.toContain("194");
  expect(mock.db.examResult.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "learner-A" }) }));
  expect(mock.db.studyTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "learner-A" }) }));
});

it("labels and queries the actual future start date instead of claiming it is today's plan", async () => {
  mock.settings.planStart = addDateKeys(dateKey(), 10);
  const page = pageSnapshot(await DashboardPage());
  expect(page).toContain("План на ");
  expect(page).not.toContain("План на сьогодні");
  expect(mock.db.studyTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ dateKey: mock.settings.planStart }) }));
});

it("keeps long real names, completed tasks and the actual scheduled mock without synthetic replacements", async () => {
  mock.user.firstName = "ДужеДовгеУкраїнськеІм’я".repeat(8);
  const title = "Власна навчальна задача з довгою назвою ".repeat(8);
  mock.db.studyTask.findMany.mockResolvedValue([{ id: "task-A", dateKey: dateKey(), title, durationMin: 15, status: "DONE", topicId: null, subjectId: "biology", kind: "CUSTOM" }]);
  mock.db.studyTask.findFirst.mockResolvedValue({ id: "mock-A", dateKey: addDateKeys(dateKey(), 2), title: "Свій запланований пробник", durationMin: 60, subjectId: "biology" });
  const page = pageSnapshot(await DashboardPage());
  expect(page).toContain(mock.user.firstName);
  expect(page).toContain(title);
  expect(page).toContain("Виконано");
  expect(page).toContain("Свій запланований пробник");
  expect(page).not.toContain("Андрію");
});
