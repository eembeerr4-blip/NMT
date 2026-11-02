import { afterAll, beforeAll, expect, it, vi } from "vitest";
import path from "node:path";
import { createHash } from "node:crypto";

const dryRun = vi.hoisted(() => {
  const backup = process.env.STAGE6_DRY_RUN_DB;
  if (!backup) throw new Error("Set STAGE6_DRY_RUN_DB to absolute path of QA copy from production backup.");
  return { backup };
});

const TOPICS = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const auth = vi.hoisted(() => ({ id: "owner" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const database = path.resolve(dryRun.backup);
  return { prisma: new PrismaClient({ datasourceUrl: `file:${database.replaceAll("\\", "/")}?connection_limit=1` }) };
});
vi.mock("@/server/session", () => ({
  getSessionUser: () => prisma.user.findUnique({ where: { id: auth.id } }),
  createSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { publishLesson } from "@/server/content-import";

let baselineCoverage: Record<string, string>;

beforeAll(async () => {
  const owner = await prisma.user.findFirst({ where: { OR: [{ id: "owner" }, { role: "OWNER" }] } });
  if (!owner) throw new Error("OWNER user missing on dry-run DB copy.");
  auth.id = owner.id;
  baselineCoverage = Object.fromEntries((await prisma.topic.findMany({ select: { id: true, coverage: true } })).map((t) => [t.id, t.coverage]));
  for (const topicId of TOPICS) expect(baselineCoverage[topicId]).toBe("DRAFT");
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
});

it("dry-run publishes exactly seven allowlisted lessons via publishLesson", async () => {
  for (const topicId of TOPICS) {
    const result = await publishLesson(topicId);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const topic = await prisma.topic.findUniqueOrThrow({ where: { id: topicId } });
    expect(topic.coverage).toBe("READY");
  }
  const after = Object.fromEntries((await prisma.topic.findMany({ select: { id: true, coverage: true } })).map((t) => [t.id, t.coverage]));
  for (const [id, before] of Object.entries(baselineCoverage)) {
    if (TOPICS.includes(id)) expect(after[id]).toBe("READY");
    else expect(after[id]).toBe(before);
  }
  const fingerprintsBefore = process.env.STAGE6_DRY_RUN_FP_BEFORE;
  if (fingerprintsBefore) {
    const before = JSON.parse(fingerprintsBefore) as Record<string, { count: number; hash: string }>;
    for (const table of ["TestAttempt", "Answer", "StudyTask", "Mistake", "ReviewSchedule", "UserTopicProgress"]) {
      const countRows = await prisma.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*) as c FROM "${table}"`);
      const count = Number(countRows[0].c);
      expect(count).toBe(before[table]?.count ?? count);
      if (count > 0) {
        const rows = await prisma.$queryRawUnsafe<{ blob: string }[]>(
          `SELECT group_concat(rowid || ':' || quote(rowid), '|') as blob FROM "${table}" ORDER BY rowid`,
        );
        const hash = createHash("sha256").update(rows[0]?.blob ?? "").digest("hex");
        expect(hash).toBe(before[table].hash);
      }
    }
  }
});
