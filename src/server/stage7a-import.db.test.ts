import { afterAll, beforeAll, expect, it } from "vitest";
import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { inspectContentPackage, parseContentPackage } from "@/lib/content-package";
import { productionDevDbPath, assertStage7aQaDatabase } from "@/lib/stage7a-production-guard";
import { importStage7aContentPackage } from "@/server/stage7a-batch-import";

const STAGE6_READY_TOPICS = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const qaDbPath = path.join(process.cwd(), "prisma", "stage7a-qa.db");
const productionPath = productionDevDbPath(process.cwd());

async function fingerprintTables(db: PrismaClient) {
  const [users, tasks, audit] = await Promise.all([
    db.user.findMany({ select: { id: true, role: true, accountStatus: true }, orderBy: { id: "asc" } }),
    db.studyTask.findMany({ select: { id: true, userId: true, dateKey: true, templateKey: true }, orderBy: { id: "asc" } }),
    db.auditLog.findMany({ select: { id: true, action: true, entityId: true }, orderBy: { id: "asc" } }),
  ]);
  const serialize = (rows: unknown[]) => JSON.stringify(rows);
  return {
    userCount: users.length,
    studyTaskCount: tasks.length,
    auditLogCount: audit.length,
    userDigest: serialize(users),
    studyTaskDigest: serialize(tasks),
    auditLogDigest: serialize(audit),
  };
}

function loadManifest() {
  const manifestPath = path.join(process.cwd(), "content/stage7a/stage7a-content-manifest.v2.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as {
    packages: { file: string; subjectId: string; topicIds: string[] }[];
    topicIds: string[];
  };
}

let prisma: PrismaClient;
let readySnapshots: Map<string, { coverage: string; lessonJson: string }>;
let userFingerprintBefore: Awaited<ReturnType<typeof fingerprintTables>>;

beforeAll(async () => {
  const catalogSource = "D:/НМТ Сайт/backups/stage7a-catalog-source.db";
  copyFileSync(catalogSource, qaDbPath);
  process.env.DATABASE_URL = `file:${qaDbPath.replace(/\\/g, "/")}`;
  assertStage7aQaDatabase(process.env.DATABASE_URL, process.cwd());
  expect(productionPath).not.toBe(path.normalize(qaDbPath));

  prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  readySnapshots = new Map();
  for (const id of STAGE6_READY_TOPICS) {
    const topic = await prisma.topic.findUnique({ where: { id } });
    if (!topic) throw new Error(`Missing READY topic ${id} in QA db`);
    readySnapshots.set(id, { coverage: topic.coverage, lessonJson: topic.lessonJson });
  }
  userFingerprintBefore = await fingerprintTables(prisma);
}, 60000);

afterAll(async () => {
  await prisma?.$disconnect();
});

it("refuses import when DATABASE_URL points at production dev.db", () => {
  expect(() => assertStage7aQaDatabase(`file:${productionPath.replace(/\\/g, "/")}`, process.cwd())).toThrow(/refused/i);
});

it("validates manifest packages against DB lookup and imports idempotently", async () => {
  const manifest = loadManifest();
  const countsBefore = await prisma.question.count();

  for (const pkgMeta of manifest.packages) {
    const raw = readFileSync(path.join(process.cwd(), "content/stage7a", pkgMeta.file), "utf8");
    const parsed = parseContentPackage(raw);
    expect(parsed.package, JSON.stringify(parsed.report.errors)).toBeDefined();
    const topics = await prisma.topic.findMany({
      where: { id: { in: pkgMeta.topicIds } },
      select: { id: true, subjectId: true, parentId: true, coverage: true, lessonJson: true },
    });
    const questions = await prisma.question.findMany({
      where: { topicId: { in: pkgMeta.topicIds } },
      select: { id: true, topicId: true, subjectId: true, prompt: true, verificationStatus: true },
    });
    const used = await prisma.testQuestion.findMany({
      where: { questionId: { in: questions.map((q) => q.id) } },
      select: { questionId: true },
    });
    const usedIds = new Set(used.map((u) => u.questionId));
    const lookup = {
      subject: await prisma.subject.findUnique({ where: { id: pkgMeta.subjectId } }),
      topics,
      questions: questions.map((q) => ({ ...q, usedInTest: usedIds.has(q.id) })),
      videos: await prisma.videoLesson.findMany({ where: { topicId: { in: pkgMeta.topicIds } } }),
    };
    const plan = inspectContentPackage(raw, lookup);
    expect(plan.report.ok, JSON.stringify(plan.report.errors)).toBe(true);

    const first = await importStage7aContentPackage(raw, prisma);
    expect(first.ok, first.error).toBe(true);
  }

  for (const topicId of manifest.topicIds) {
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { questions: true },
    });
    expect(topic.coverage).toBe("DRAFT");
    expect(topic.lessonJson.length).toBeGreaterThan(600);
    expect(topic.questions).toHaveLength(12);
    expect(topic.questions.every((q) => q.verificationStatus === "DRAFT")).toBe(true);
  }

  const createdIds = new Set(
    manifest.packages.flatMap((p: { createTopicIds?: string[]; topicIds: string[] }) =>
      p.createTopicIds?.length ? p.createTopicIds : [],
    ),
  );
  for (const id of createdIds) {
    const before = readySnapshots.has(id);
    expect(before).toBe(false);
  }

  const countsAfterFirst = await prisma.question.count();
  expect(countsAfterFirst - countsBefore).toBe(120);

  for (const pkgMeta of manifest.packages) {
    const raw = readFileSync(path.join(process.cwd(), "content/stage7a", pkgMeta.file), "utf8");
    const second = await importStage7aContentPackage(raw, prisma);
    expect(second.ok, second.error).toBe(true);
    expect(second.report?.counts.questionsToCreate ?? 0).toBe(0);
    expect(second.report?.counts.topicsToUpdate ?? 0).toBeGreaterThan(0);
  }

  expect(await prisma.question.count()).toBe(countsAfterFirst);

  for (const [id, snap] of readySnapshots) {
    const topic = await prisma.topic.findUniqueOrThrow({ where: { id } });
    expect(topic.coverage).toBe(snap.coverage);
    expect(topic.lessonJson).toBe(snap.lessonJson);
  }

  const userFingerprintAfter = await fingerprintTables(prisma);
  expect(userFingerprintAfter).toEqual(userFingerprintBefore);

  const integrity = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  expect(integrity[0]?.integrity_check).toBe("ok");
  const fk = (await prisma.$queryRawUnsafe("PRAGMA foreign_key_check")) as unknown[];
  expect(fk.length).toBe(0);
}, 120000);
