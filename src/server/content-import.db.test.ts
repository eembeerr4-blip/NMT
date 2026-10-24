import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { lessonAccess } from "@/lib/readiness";
import { CONTENT_PACKAGE_LIMITS } from "@/lib/content-package-limits";

const auth = vi.hoisted(() => ({ id: "owner" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-content-import-"));
  const database = path.join(folder, "qa.db");
  return { prisma: new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") }), folder, database };
});
vi.mock("@/server/session", () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: auth.id } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { initializeSQLite } from "@/lib/sqlite-init";
import { saveLessonContent } from "./actions";
import { importContentPackage, previewContentPackage, publishLesson } from "./content-import";

const theory = "Еукаріотична клітина має мембрану, цитоплазму та ядро. Цей текст достатній для чернетки.";
const lesson = { theory, objectives: ["Мета"], rules: [], examples: [], mistakes: [], summary: "Коротко" };
function question(code: string, patch: Record<string, unknown> = {}) {
  return { code, type: "NUMERIC", difficulty: "EASY", prompt: `Питання ${code} для імпорту`, explanation: "Чотири.", correctAnswer: "4", options: [], ...patch };
}
function topic(code: string, patch: Record<string, unknown> = {}) {
  return { code, title: `Тема ${code}`, summary: "Опис", lesson, questions: [question(`${code}-q`)], video: { url: "https://youtu.be/abcdefghijk", title: "Кандидат" }, ...patch };
}
function raw(topics: unknown[], subjectId = "biology", section = "pkg-import-section") {
  return JSON.stringify({ format: "nmt-content-package", version: 1, subjectId, provenance: { origin: "original", title: "NMT Academy", license: "original", note: "тест" }, sections: [{ code: section, title: "Імпортований розділ", summary: "", topics }] });
}

beforeAll(async () => {
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  writeFileSync(database, "");
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: "file:" + database.replaceAll("\\", "/") }, stdio: "pipe", timeout: 60000,
  });
  await initializeSQLite(prisma);
  await prisma.subject.createMany({ data: [
    { id: "biology", name: "Біологія", shortName: "Біологія", description: "QA", color: "#2f8f6b", sortOrder: 1 },
    { id: "math", name: "Математика", shortName: "Математика", description: "QA", color: "#4f6df5", sortOrder: 2 },
  ] });
  for (const [id, role] of [["owner", "OWNER"], ["editor", "EDITOR"], ["student", "STUDENT"]] as const) {
    await prisma.user.create({ data: { id, role, nickname: id, firstName: id, onboarded: true, accountStatus: "APPROVED" } });
  }
  await prisma.topic.create({ data: { id: "math-protected", subjectId: "math", title: "Захищена", sortOrder: 1, coverage: "VERIFIED", lessonJson: JSON.stringify({ objectives: [], theory: "Уже опублікований конспект, який імпорт не має замінити новим текстом.", rules: [], examples: [], mistakes: [], summary: "" }) } });
  await prisma.topic.create({ data: { id: "math-empty", subjectId: "math", title: "Порожня", sortOrder: 2, coverage: "NEEDS_CONTENT", lessonJson: "" } });
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  const { folder } = await import("@/lib/prisma") as unknown as { folder: string };
  rmSync(folder, { recursive: true, force: true });
});

it("imports a valid package as editable drafts and does not publish it", async () => {
  auth.id = "editor";
  const payload = raw([topic("pkg-draft")]);
  const preview = await previewContentPackage(payload);
  expect(preview.ok, JSON.stringify(preview)).toBe(true);
  expect(await prisma.topic.count({ where: { id: "pkg-draft" } })).toBe(0);
  const imported = await importContentPackage(payload);
  expect(imported.ok, JSON.stringify(imported)).toBe(true);
  const saved = await prisma.topic.findUniqueOrThrow({ where: { id: "pkg-draft" }, include: { videos: true, questions: true } });
  expect(saved.coverage).toBe("DRAFT");
  expect(saved.lessonJson).toContain("Еукаріотична клітина");
  expect(saved.lessonJson).toContain("\"origin\":\"original\"");
  expect(saved.questions[0]).toMatchObject({ verificationStatus: "DRAFT", generatedByAi: true });
  expect(saved.videos[0]).toMatchObject({ reviewStatus: "SUGGESTED", youtubeId: "abcdefghijk" });
  expect(lessonAccess(saved).available).toBe(false);
  expect(await prisma.auditLog.count({ where: { action: "CONTENT_IMPORTED" } })).toBe(1);
});

it("rejects invalid, empty, duplicate, missing-topic, bad-answer, bad-video and oversized packages without writing", async () => {
  auth.id = "owner";
  const before = await prisma.topic.count();
  const cases = [
    "{",
    JSON.stringify({ format: "nmt-content-package", version: 1, subjectId: "biology", provenance: { origin: "original", title: "NMT", license: "original" }, sections: [] }),
    raw([topic("same-code"), topic("same-code")]),
    raw([topic("pkg-missing", { questions: [question("pkg-missing-q", { topicCode: "missing-topic", type: "NUMERIC" })] })]),
    raw([topic("pkg-bad-answer", { questions: [{ code: "pkg-bad-q", type: "SINGLE_CHOICE", difficulty: "EASY", prompt: "Яка органела?", explanation: "Ядро.", correctAnswer: "В", options: [{ label: "А", text: "Ядро" }, { label: "Б", text: "Стінка" }] }] })]),
    raw([topic("pkg-bad-video", { video: { url: "https://evil.example/embed/abcdefghijk", title: "" } })]),
    "x".repeat(CONTENT_PACKAGE_LIMITS.maxBytes + 1),
  ];
  for (const payload of cases) expect((await importContentPackage(payload)).ok, payload.slice(0, 80)).toBe(false);
  expect(await prisma.topic.count()).toBe(before);
});

it("does not partially keep the first topic when a later topic is invalid or the write fails", async () => {
  auth.id = "owner";
  const before = await prisma.topic.count();
  const invalid = raw([topic("pkg-partial-ok"), topic("pkg-partial-bad", { questions: [question("pkg-partial-bad-q", { correctAnswer: "not-a-number" })] })]);
  expect((await importContentPackage(invalid)).ok).toBe(false);
  expect(await prisma.topic.findUnique({ where: { id: "pkg-partial-ok" } })).toBeNull();
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await prisma.$executeRawUnsafe("CREATE TRIGGER qa_import_abort BEFORE INSERT ON Question WHEN NEW.id = 'pkg-abort-topic-q' BEGIN SELECT RAISE(ROLLBACK, 'qa import abort'); END");
  try {
    expect((await importContentPackage(raw([topic("pkg-abort-ok"), topic("pkg-abort-topic")], "biology", "pkg-abort-section"))).ok).toBe(false);
    expect(await prisma.topic.findUnique({ where: { id: "pkg-abort-ok" } })).toBeNull();
    expect(await prisma.topic.findUnique({ where: { id: "pkg-abort-section" } })).toBeNull();
    expect(await prisma.topic.findUnique({ where: { id: "pkg-abort-topic" } })).toBeNull();
  } finally {
    errors.mockRestore();
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS qa_import_abort");
  }
  expect(await prisma.topic.count()).toBe(before);
});

it("refuses a learner, skips protected lessons, fills an empty topic and does not duplicate a repeated import", async () => {
  auth.id = "student";
  expect((await importContentPackage(raw([topic("pkg-denied")]))).ok).toBe(false);
  expect(await prisma.topic.findUnique({ where: { id: "pkg-denied" } })).toBeNull();
  auth.id = "owner";
  const protectedBefore = await prisma.topic.findUniqueOrThrow({ where: { id: "math-protected" } });
  const skipped = await importContentPackage(raw([topic("math-protected", { title: "Спроба заміни", lesson: { ...lesson, theory: "Новий текст, який не можна записати поверх опублікованого уроку без явної дії." } })], "math", "pkg-math-section"));
  expect(skipped.ok, JSON.stringify(skipped)).toBe(true);
  expect(await prisma.topic.findUnique({ where: { id: "math-protected" } })).toMatchObject({ title: protectedBefore.title, lessonJson: protectedBefore.lessonJson, coverage: "VERIFIED" });
  const again = await importContentPackage(raw([topic("pkg-draft")]));
  expect(again.ok, JSON.stringify(again)).toBe(true);
  expect(await prisma.topic.count({ where: { id: "pkg-draft" } })).toBe(1);
  expect(await prisma.question.count({ where: { topicId: "pkg-draft" } })).toBe(1);
  const filled = await importContentPackage(raw([topic("math-empty", { title: "Заповнена порожня тема", video: undefined })], "math", "pkg-math-empty-section"));
  expect(filled.ok, JSON.stringify(filled)).toBe(true);
  expect(await prisma.topic.findUnique({ where: { id: "math-empty" } })).toMatchObject({ coverage: "DRAFT", title: "Заповнена порожня тема" });
});

it("keeps an imported lesson editable, publishes it only on request, and shows it to a learner only then", async () => {
  auth.id = "editor";
  const edited = await saveLessonContent("pkg-draft", {
    objectives: ["Оновлена ціль"], theory: "Оновлений конспект імпортованого уроку залишається чернеткою, доки редактор окремо не опублікує його учням.",
    rules: [], examples: [], mistakes: [], summary: "Оновлено", notes: "Примітка після імпорту",
  });
  expect(edited.ok, JSON.stringify(edited)).toBe(true);
  const draft = await prisma.topic.findUniqueOrThrow({ where: { id: "pkg-draft" }, include: { questions: true, videos: true } });
  expect(draft.coverage).toBe("DRAFT");
  expect(draft.lessonJson).toContain("Оновлений конспект");
  expect(draft.lessonJson).toContain("Примітка після імпорту");
  expect(draft.lessonJson).toContain("\"origin\":\"original\"");
  expect(lessonAccess({ ...draft, questions: draft.questions, videos: draft.videos }).available).toBe(false);
  const published = await publishLesson("pkg-draft");
  expect(published.ok, JSON.stringify(published)).toBe(true);
  const live = await prisma.topic.findUniqueOrThrow({ where: { id: "pkg-draft" }, include: { questions: true, videos: true } });
  expect(live.coverage).toBe("READY");
  expect(live.questions[0].verificationStatus).toBe("DRAFT");
  expect(live.videos[0].reviewStatus).toBe("SUGGESTED");
  expect(lessonAccess({ lessonJson: live.lessonJson, coverage: "DRAFT" }).available).toBe(false);
  expect(lessonAccess({ lessonJson: live.lessonJson, coverage: live.coverage, questions: [], videos: live.videos }).available).toBe(true);
  expect(lessonAccess({ lessonJson: live.lessonJson, coverage: live.coverage, questions: [], videos: live.videos }).video).toBe(false);
});

it("imports a large package inside the topic limit", async () => {
  auth.id = "owner";
  const topics = Array.from({ length: CONTENT_PACKAGE_LIMITS.maxTopics }, (_, index) => topic(`pkg-bulk-${index}`, { video: undefined, questions: [question(`pkg-bulk-${index}-q`)] }));
  const result = await importContentPackage(raw(topics, "biology", "pkg-bulk-section"));
  expect(result.ok, JSON.stringify(result).slice(0, 500)).toBe(true);
  expect(await prisma.topic.count({ where: { id: { startsWith: "pkg-bulk-" }, coverage: "DRAFT" } })).toBe(CONTENT_PACKAGE_LIMITS.maxTopics);
  expect(await prisma.question.count({ where: { topicId: { startsWith: "pkg-bulk-" } } })).toBe(CONTENT_PACKAGE_LIMITS.maxTopics);
  expect(await prisma.topic.count({ where: { id: "pkg-bulk-section", coverage: "NEEDS_CONTENT" } })).toBe(1);
}, 60000);
