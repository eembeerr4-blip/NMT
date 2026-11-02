/**
 * Isolated QA import test for math-basics-01.package.fixed-v4.json
 * Following the pattern from content-import.db.test.ts
 */
import { afterAll, beforeAll, expect, it, vi, describe } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { lessonAccess } from "@/lib/readiness";

const auth = vi.hoisted(() => ({ id: "owner" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-qa-math-v4-"));
  const database = path.join(folder, "qa.db");
  return { prisma: new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") }), folder, database };
});
vi.mock("@/server/session", () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: auth.id } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { initializeSQLite } from "@/lib/sqlite-init";
import { importContentPackage, previewContentPackage, publishLesson } from "@/server/content-import";

const FIXED_V4 = String.raw`D:\матерелы ТГК\_NMT_ПАКЕТИ\math\math-basics-01.package.fixed-v4.json`;

beforeAll(async () => {
  const { database } = (await import("@/lib/prisma")) as unknown as { database: string };
  writeFileSync(database, "");
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: "file:" + database.replaceAll("\\", "/") },
    stdio: "pipe",
    timeout: 60000,
  });
  await initializeSQLite(prisma);
  await prisma.subject.createMany({
    data: [
      { id: "math", name: "Математика", shortName: "Математика", description: "QA", color: "#4f6df5", sortOrder: 1 },
    ],
  });
  for (const [id, role] of [["owner", "OWNER"], ["editor", "EDITOR"], ["student", "STUDENT"]] as const) {
    await prisma.user.create({ data: { id, role, nickname: id, firstName: id, onboarded: true, accountStatus: "APPROVED" } });
  }
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  const { folder } = (await import("@/lib/prisma")) as unknown as { folder: string };
  rmSync(folder, { recursive: true, force: true });
});

const rawV4 = readFileSync(FIXED_V4, "utf-8");

describe("Math Basics v4 isolated import", () => {
  it("preview succeeds and recognizes 30 questions in 3 topics", async () => {
    auth.id = "editor";
    const preview = await previewContentPackage(rawV4);
    expect(preview.ok, JSON.stringify(preview)).toBe(true);
    if (!preview.ok) return;
    expect(preview.report.questionCount).toBe(30);
    expect(preview.report.topics.length).toBe(3);
    expect(preview.report.topics.map(t => t.code)).toEqual(["fractions", "percentages", "ratios"]);
    expect(preview.report.topics.every(t => t.questions === 10)).toBe(true);
    expect(preview.report.errors).toEqual([]);
    // Verify nothing was written yet
    expect(await prisma.topic.count({ where: { id: "fractions" } })).toBe(0);
  });

  it("import creates 3 topics (DRAFT) and 30 questions (DRAFT)", async () => {
    auth.id = "editor";
    const result = await importContentPackage(rawV4);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.report.counts.topicsToCreate).toBe(3);
    expect(result.report.counts.questionsToCreate).toBe(30);
    expect(result.report.counts.sectionsToCreate).toBe(1);

    // Verify DB state
    const section = await prisma.topic.findUnique({ where: { id: "basics" } });
    expect(section).toBeTruthy();

    for (const code of ["fractions", "percentages", "ratios"]) {
      const topic = await prisma.topic.findUniqueOrThrow({ where: { id: code }, include: { questions: { include: { options: true } } } });
      expect(topic.coverage).toBe("DRAFT");
      expect(topic.subjectId).toBe("math");
      expect(topic.questions.length).toBe(10);
      for (const q of topic.questions) {
        expect(q.verificationStatus).toBe("DRAFT");
        expect(q.generatedByAi).toBe(true);
      }
    }

    // Total counts
    const totalQuestions = await prisma.question.count({ where: { subjectId: "math" } });
    expect(totalQuestions).toBe(30);

    // Check specific questions
    const fracQ8 = await prisma.question.findUniqueOrThrow({ where: { id: "frac-q8" }, include: { options: true } });
    expect(fracQ8.type).toBe("SINGLE_CHOICE");
    expect(fracQ8.options.length).toBe(3);

    const fracQ4 = await prisma.question.findUniqueOrThrow({ where: { id: "frac-q4" } });
    expect(fracQ4.type).toBe("NUMERIC");
  });

  it("STUDENT cannot see DRAFT lessons", async () => {
    for (const code of ["fractions", "percentages", "ratios"]) {
      const topic = await prisma.topic.findUniqueOrThrow({
        where: { id: code },
        include: { questions: true, videos: true },
      });
      expect(topic.coverage).toBe("DRAFT");
      expect(lessonAccess(topic).available).toBe(false);
    }
  });

  it("re-import does not create duplicates", async () => {
    auth.id = "editor";
    const result = await importContentPackage(rawV4);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    // Counts should show updates/skips, not new creates
    expect(result.report.counts.topicsToCreate).toBe(0);
    expect(result.report.counts.questionsToCreate).toBe(0);
    // Verify still exactly 30 questions
    const totalQuestions = await prisma.question.count({ where: { subjectId: "math" } });
    expect(totalQuestions).toBe(30);
    // Still exactly 3 topics (plus 1 section)
    const topics = await prisma.topic.count({ where: { subjectId: "math", parentId: "basics" } });
    expect(topics).toBe(3);
  });

  it("STUDENT cannot import", async () => {
    auth.id = "student";
    const result = await importContentPackage(rawV4);
    expect(result.ok).toBe(false);
  });
});

