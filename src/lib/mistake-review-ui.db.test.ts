import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { addDateKeys, dateKey } from "@/lib/dates";

const auth = vi.hoisted(() => ({ id: "stage5-student-a" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage5-"));
  const database = path.join(folder, "stage5.db");
  return { prisma: new PrismaClient({ datasources: { db: { url: "file:" + database.replaceAll("\\", "/") } } }), folder, database };
});
vi.mock("@/server/session", () => ({
  getSessionUser: () => prisma.user.findUnique({ where: { id: auth.id }, include: { subjects: true } }),
  requireUser: () => prisma.user.findUniqueOrThrow({ where: { id: auth.id }, include: { subjects: true } }),
  createSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { initializeSQLite } from "@/lib/sqlite-init";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE } from "@/lib/constants";
import MistakesPage from "@/app/(main)/mistakes/page";
import ReviewPage from "@/app/(main)/review/page";

const lessonPublished = JSON.stringify({
  objectives: ["Мета"],
  theory: "Опублікований конспект ".repeat(40),
  rules: ["Правило"],
  examples: [{ task: "1", solution: "1" }, { task: "2", solution: "2" }],
  mistakes: ["Помилка"],
  summary: "Підсумок",
});

function view(value: unknown) {
  return JSON.stringify(value, (key, item) => (["type", "_owner", "_store"].includes(key) ? undefined : item));
}

beforeAll(async () => {
  const fixture = (await import("@/lib/prisma")) as unknown as { database: string };
  writeFileSync(fixture.database, "");
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: "file:" + fixture.database.replaceAll("\\", "/") },
    stdio: "pipe",
    timeout: 60000,
  });
  await initializeSQLite(prisma);
  await prisma.subject.create({ data: { id: "math", name: "Математика", shortName: "Матем.", description: "QA", color: "#000", sortOrder: 0 } });
  for (const id of ["stage5-student-a", "stage5-student-b"]) {
    await prisma.user.create({ data: { id, nickname: id, firstName: id, onboarded: true, accountStatus: "APPROVED", role: "STUDENT", passwordHash: "QA-only-unused-hash" } });
    await prisma.userSettings.create({ data: { id, userId: id, mathPriority: 30, scheduleJson: JSON.stringify(DEFAULT_SCHEDULE), formatJson: JSON.stringify(DEFAULT_FORMAT) } });
    await prisma.userSubject.create({ data: { userId: id, subjectId: "math", role: "mandatory", active: true } });
  }
  await prisma.topic.create({
    data: {
      id: "stage5-topic",
      subjectId: "math",
      title: "STAGE5_TOPIC",
      coverage: "READY",
      sortOrder: 0,
      lessonJson: lessonPublished,
      questions: {
        create: [
          { id: "stage5-q-open", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "OPEN prompt", correctAnswer: "1", explanation: "1", verificationStatus: "VERIFIED" },
          { id: "stage5-q-review", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "REVIEW prompt", correctAnswer: "2", explanation: "2", verificationStatus: "VERIFIED" },
          { id: "stage5-q-fixed", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "FIXED prompt", correctAnswer: "3", explanation: "3", verificationStatus: "VERIFIED" },
        ],
      },
    },
  });
  await prisma.topic.create({
    data: {
      id: "stage5-draft-topic",
      subjectId: "math",
      title: "STAGE5_DRAFT_TOPIC",
      coverage: "DRAFT",
      sortOrder: 1,
      lessonJson: lessonPublished,
      questions: {
        create: { id: "stage5-q-draft", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "DRAFT prompt hidden", correctAnswer: "9", explanation: "9", verificationStatus: "VERIFIED" },
      },
    },
  });
  const today = dateKey();
  await prisma.mistake.createMany({
    data: [
      { id: "m-open", userId: "stage5-student-a", subjectId: "math", topicId: "stage5-topic", questionId: "stage5-q-open", prompt: "OPEN prompt", userAnswer: "0", correctAnswer: "1", explanation: "1", status: "OPEN" },
      { id: "m-review", userId: "stage5-student-a", subjectId: "math", topicId: "stage5-topic", questionId: "stage5-q-review", prompt: "REVIEW prompt", userAnswer: "0", correctAnswer: "2", explanation: "2", status: "REVIEWING" },
      { id: "m-fixed", userId: "stage5-student-a", subjectId: "math", topicId: "stage5-topic", questionId: "stage5-q-fixed", prompt: "FIXED prompt", userAnswer: "0", correctAnswer: "3", explanation: "3", status: "FIXED" },
      { id: "m-draft", userId: "stage5-student-a", subjectId: "math", topicId: "stage5-draft-topic", questionId: "stage5-q-draft", prompt: "DRAFT prompt hidden", userAnswer: "0", correctAnswer: "9", explanation: "9", status: "OPEN" },
      { id: "m-other-user", userId: "stage5-student-b", subjectId: "math", topicId: "stage5-topic", questionId: "stage5-q-open", prompt: "OTHER USER", userAnswer: "0", correctAnswer: "1", explanation: "1", status: "OPEN" },
    ],
  });
  await prisma.reviewSchedule.createMany({
    data: [
      { id: "r-overdue", userId: "stage5-student-a", topicId: "stage5-topic", dueKey: addDateKeys(today, -2), intervalDays: 1, priority: 2, status: "PENDING" },
      { id: "r-today", userId: "stage5-student-a", topicId: "stage5-topic", dueKey: today, intervalDays: 7, priority: 0, status: "PENDING" },
      { id: "r-future", userId: "stage5-student-a", topicId: "stage5-topic", dueKey: addDateKeys(today, 5), intervalDays: 30, priority: 0, status: "PENDING" },
      { id: "r-draft", userId: "stage5-student-a", topicId: "stage5-draft-topic", dueKey: today, intervalDays: 1, priority: 0, status: "PENDING" },
    ],
  });
  await prisma.userTopicProgress.create({ data: { userId: "stage5-student-a", topicId: "stage5-topic", status: "NEEDS_REVIEW" } });
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  const fixture = (await import("@/lib/prisma")) as unknown as { folder: string; database: string };
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(fixture.database + suffix)) unlinkSync(fixture.database + suffix);
  }
  rmdirSync(fixture.folder);
});

it("shows readable mistake counters and hides draft or foreign records", async () => {
  auth.id = "stage5-student-a";
  const html = view(await MistakesPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('"open":1');
  expect(html).toContain('"reviewing":1');
  expect(html).toContain('"fixed":1');
  expect(html).toContain("OPEN prompt");
  expect(html).toContain("REVIEW prompt");
  expect(html).toContain("FIXED prompt");
  expect(html).not.toContain("DRAFT prompt hidden");
  expect(html).not.toContain("OTHER USER");
  expect(html).toContain("Заплановане повторення");
});

it("orders review queues and hides draft schedules", async () => {
  auth.id = "stage5-student-a";
  const html = view(await ReviewPage());
  expect(html.indexOf("Прострочені")).toBeLessThan(html.indexOf("Сьогодні"));
  expect(html).toContain("STAGE5_TOPIC");
  expect(html).not.toContain("STAGE5_DRAFT_TOPIC");
  expect(html).toContain('"overdueCount":1');
  expect(html).toContain('"todayCount":1');
  expect(html).toContain("/mistakes?topic=stage5-topic");
});

it("student B cannot see student A mistakes on the page", async () => {
  auth.id = "stage5-student-b";
  const html = view(await MistakesPage({ searchParams: Promise.resolve({}) }));
  expect(html).not.toContain("OPEN prompt");
  expect(html).not.toContain("REVIEW prompt");
});

it("viewing pages does not create new mistakes or review rows", async () => {
  auth.id = "stage5-student-a";
  const beforeM = await prisma.mistake.count();
  const beforeR = await prisma.reviewSchedule.count();
  await MistakesPage({ searchParams: Promise.resolve({}) });
  await ReviewPage();
  expect(await prisma.mistake.count()).toBe(beforeM);
  expect(await prisma.reviewSchedule.count()).toBe(beforeR);
});
