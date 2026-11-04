import { afterAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { parseContentPackage, type ContentPackage } from "@/lib/content-package";
import { lessonReadiness } from "@/lib/readiness";
import { hashPasswordAsync } from "@/lib/auth";
import { DEFAULT_FORMAT } from "@/lib/constants";
const location = process.env.STAGE82_BALANCED_LOCATION;
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage82-balanced-"));
  const database = path.join(folder, "qa.db");
  return { prisma: new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") + "?connection_limit=1" }), database, folder };
});
vi.mock("@/server/session", () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: "owner" }, include: { subjects: true } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { importContentPackage, publishLesson } from "@/server/content-import";
import { verifyQuestion } from "@/server/actions";
import { saveTestSet, setTestPublication } from "@/server/test-sets";
afterAll(async () => { await prisma.$disconnect(); });
it.skipIf(!location)("approves and publishes only the reviewed real pilot in a unique disposable browser database", async () => {
  const { database, folder } = await import("@/lib/prisma") as unknown as { database: string; folder: string };
  expect(path.basename(folder)).toMatch(/^nmt-stage82-balanced-/);
  expect(path.dirname(folder)).toBe(path.resolve(tmpdir()));
  writeFileSync(database, "", { flag: "wx" });
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: "file:" + database.replaceAll("\\", "/") }, stdio: "pipe", timeout: 60000 });
  const password = randomBytes(20).toString("hex");
  const passwordHash = await hashPasswordAsync(password);
  await prisma.subject.create({ data: { id: "math", name: "Математика", shortName: "Математика", description: "Ізольований пілот", color: "#123456", sortOrder: 0 } });
  for (const id of ["owner", "s82_student", "s82_other"]) {
    await prisma.user.create({ data: { id, nickname: id, firstName: id, role: id === "owner" ? "OWNER" : "STUDENT", accountStatus: "APPROVED", onboarded: true, diagnosticSkipped: true, passwordHash, emailVerifiedAt: new Date() } });
    await prisma.userSettings.create({ data: { id, userId: id, scheduleJson: JSON.stringify({ anchorMockDate: "2026-11-02", rotation: ["math"], externalPractice: { enabled: false, days: [], durationMin: 0 }, days: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, []])) }), formatJson: JSON.stringify(DEFAULT_FORMAT) } });
    await prisma.userSubject.create({ data: { userId: id, subjectId: "math", active: true, role: "required" } });
  }
  const parsed = parseContentPackage(readFileSync("content/stage8/validation82/packages/math-reviewed.package.json", "utf8"));
  expect(parsed.report.errors).toEqual([]);
  const pkg = parsed.package!;
  pkg.sections[0].topics = pkg.sections[0].topics.filter(t => t.code === "math-expressions");
  pkg.sections[0].code = "s82-balanced-pilot";
  expect((await importContentPackage(JSON.stringify(pkg))).ok).toBe(true);
  for (const q of await prisma.question.findMany()) expect(await verifyQuestion(q.id, "VERIFIED")).toMatchObject({ ok: true });
  const draft = await prisma.topic.findUniqueOrThrow({ where: { id: "math-expressions" }, include: { questions: true, children: true, videos: true } });
  const gate = lessonReadiness(draft);
  expect(gate).toMatchObject({ counts: { EASY: 4, MEDIUM: 5, HARD: 3 }, ready: true });
  expect(draft.coverage).toBe("DRAFT");
  expect(await publishLesson(draft.id)).toMatchObject({ ok: true });
  expect((await prisma.topic.findUniqueOrThrow({ where: { id: draft.id } })).coverage).toBe("READY");
  const bank = JSON.parse(readFileSync("content/stage8/validation81/math-expressions-assessment-bank.json", "utf8")) as { questions: ContentPackage["sections"][number]["topics"][number]["questions"]; final: { questionIds: string[] }; delayed: { questionIds: string[] } };
  for (const q of bank.questions) {
    const options = q.options.map((o, i) => ({ id: q.code + "-" + o.label, label: o.label, text: o.text, sortOrder: i }));
    await prisma.question.create({ data: { id: q.code, subjectId: "math", topicId: draft.id, type: q.type, difficulty: q.difficulty, prompt: q.prompt, explanation: q.explanation, correctAnswer: q.type === "SINGLE_CHOICE" ? options.find(o => o.label === q.correctAnswer)!.id : q.correctAnswer, source: q.source, verificationStatus: "DRAFT", options: { create: options } } });
    expect(await verifyQuestion(q.code, "VERIFIED")).toMatchObject({ ok: true });
  }
  const sets: Record<string, string> = {};
  for (const [purpose, questionIds] of [["FINAL", bank.final.questionIds], ["DELAYED", bank.delayed.questionIds]] as const) {
    const r = await saveTestSet({ title: purpose === "FINAL" ? "Підсумкова перевірка · Алгебраїчні вирази" : "Відкладена перевірка · Алгебраїчні вирази", subjectId: "math", timeLimitMin: 0, questionIds, assessmentPurpose: purpose });
    expect(r.ok).toBe(true); if (!r.ok || !r.id) throw new Error("Control setup failed");
    sets[purpose] = r.id; expect(await setTestPublication(r.id, "PUBLISHED")).toMatchObject({ ok: true });
  }
  const fixture = { synthetic: true, database, folder, password, sets, gate, topicId: draft.id, practiceIds: pkg.sections[0].topics[0].questions.map(q => q.code) };
  writeFileSync(path.join(folder, "stage82-fixture.json"), JSON.stringify(fixture), { flag: "wx" });
  writeFileSync(location!, JSON.stringify(fixture));
  expect(await prisma.auditLog.count({ where: { action: "LESSON_PUBLISHED", entityId: draft.id } })).toBe(1);
}, 60000);
