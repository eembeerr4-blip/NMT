import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { parseContentPackage, planContentPackage } from "../src/lib/content-package";
import { applyContentPlan, reviewedPlan } from "../src/server/content-import-core";
import { productionDevDbPath, resolveSqliteFilePath } from "../src/lib/stage7a-production-guard";
import { STAGE7B_ALLOWLIST, STAGE7B_NEW_LEAF_IDS, STAGE6_READY_TOPICS } from "./stage7b-allowlist.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "content/stage7a/stage7a-content-manifest.v2.json");

function loadManifest() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    topicIds: string[];
    packages: { file: string; subjectId: string; topicIds: string[] }[];
  };
  const allow = new Set(STAGE7B_ALLOWLIST);
  if (manifest.topicIds.length !== 10) throw new Error("Manifest must list 10 topics");
  for (const id of manifest.topicIds) {
    if (!allow.has(id)) throw new Error(`Manifest topic ${id} not in allowlist`);
  }
  for (const id of STAGE7B_ALLOWLIST) {
    if (!manifest.topicIds.includes(id)) throw new Error(`Allowlist topic ${id} missing from manifest`);
  }
  const allPkgTopics = new Set(manifest.packages.flatMap((p) => p.topicIds));
  for (const id of STAGE7B_ALLOWLIST) {
    if (!allPkgTopics.has(id)) throw new Error(`Topic ${id} not in any package`);
  }
  return manifest;
}

function assertDatabaseTarget(databaseUrl: string, mode: "qa" | "production") {
  const resolved = resolveSqliteFilePath(databaseUrl, repoRoot);
  const production = productionDevDbPath("D:/НМТ Сайт/NMT-academy");
  const productionNorm = path.normalize(production);
  if (mode === "qa") {
    if (resolved === productionNorm) {
      throw new Error(`QA mode refused: path is production dev.db (${resolved})`);
    }
  } else {
    if (resolved !== productionNorm) {
      throw new Error(`Production mode refused: expected ${productionNorm}, got ${resolved}`);
    }
    if (process.env.STAGE7B_ACK_PRODUCTION !== "yes") {
      throw new Error("Set STAGE7B_ACK_PRODUCTION=yes to write production dev.db");
    }
  }
  return resolved;
}

async function preflightTopics(db: PrismaClient) {
  const topics = await db.topic.findMany({
    where: { id: { in: [...STAGE7B_ALLOWLIST, ...STAGE6_READY_TOPICS] } },
    select: { id: true, coverage: true, lessonJson: true, parentId: true },
  });
  const byId = new Map(topics.map((t) => [t.id, t]));
  for (const id of STAGE6_READY_TOPICS) {
    const t = byId.get(id);
    if (!t || t.coverage !== "READY") throw new Error(`Stage 6 READY topic missing or changed: ${id}`);
  }
  for (const id of STAGE7B_ALLOWLIST) {
    if (STAGE7B_NEW_LEAF_IDS.has(id)) {
      if (byId.has(id)) {
        const t = byId.get(id)!;
        if (t.coverage === "READY") throw new Error(`New leaf ${id} is READY — import blocked`);
        continue;
      }
      continue;
    }
    const t = byId.get(id);
    if (!t) throw new Error(`Expected existing topic ${id} missing`);
    if (t.coverage === "READY") throw new Error(`Topic ${id} is READY — import blocked`);
    if (t.lessonJson.trim() && t.coverage !== "NEEDS_CONTENT" && t.coverage !== "DRAFT") {
      throw new Error(`Topic ${id} has protected content (coverage=${t.coverage})`);
    }
  }
}

async function importManifest(db: PrismaClient) {
  const manifest = loadManifest();
  const reports: Awaited<ReturnType<typeof reviewedPlan>>["report"][] = [];
  await db.$transaction(
    async (tx) => {
      for (const pkg of manifest.packages) {
        const raw = readFileSync(path.join(repoRoot, "content/stage7a", pkg.file), "utf8");
        const reviewed = await reviewedPlan(raw, tx);
        if (!reviewed.plan) throw new Error(reviewed.error || "Plan failed");
        for (const t of reviewed.report.topics) {
          if (STAGE7B_ALLOWLIST.includes(t.code) && t.disposition === "skip-protected") {
            throw new Error(`skip-protected for allowlist topic ${t.code}`);
          }
        }
        const skippedAllowlist = reviewed.report.topics.filter(
          (t) => STAGE7B_ALLOWLIST.includes(t.code) && t.disposition === "skip-protected",
        );
        if (skippedAllowlist.length) throw new Error("Allowlist topic skipped");
        await applyContentPlan(tx, reviewed.plan);
        reports.push(reviewed.report);
      }
    },
    { maxWait: 30000, timeout: 180000 },
  );
  return reports;
}

async function verifyAfterImport(db: PrismaClient, baselineVerifiedTotal: number) {
  const topics = await db.topic.findMany({
    where: { id: { in: STAGE7B_ALLOWLIST } },
    include: { questions: { include: { options: true } } },
  });
  if (topics.length !== 10) throw new Error(`Expected 10 batch topics, got ${topics.length}`);
  for (const t of topics) {
    if (t.coverage !== "DRAFT") throw new Error(`${t.id} coverage=${t.coverage}, expected DRAFT`);
    if (t.lessonJson.length < 600) throw new Error(`${t.id} lesson too short`);
    let lesson;
    try {
      lesson = JSON.parse(t.lessonJson);
    } catch {
      throw new Error(`${t.id} invalid lessonJson`);
    }
    if ((lesson.examples ?? []).length < 4) throw new Error(`${t.id} fewer than 4 examples`);
    if (t.questions.length !== 12) throw new Error(`${t.id} question count ${t.questions.length}`);
    const d = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of t.questions) {
      if (q.verificationStatus !== "DRAFT") throw new Error(`Question ${q.id} status ${q.verificationStatus}`);
      d[q.difficulty as keyof typeof d]++;
    }
    if (d.EASY !== 4 || d.MEDIUM !== 5 || d.HARD !== 3) throw new Error(`${t.id} bad difficulty ${JSON.stringify(d)}`);
  }
  const verifiedNew = await db.question.count({
    where: { id: { startsWith: "s7a-" }, verificationStatus: "VERIFIED" },
  });
  if (verifiedNew !== 0) throw new Error(`Found ${verifiedNew} VERIFIED s7a- questions`);
  const verifiedTotal = await db.question.count({ where: { verificationStatus: "VERIFIED" } });
  if (verifiedTotal !== baselineVerifiedTotal) {
    throw new Error(`Expected ${baselineVerifiedTotal} VERIFIED total unchanged, got ${verifiedTotal}`);
  }
  const readyVerified = await db.question.count({
    where: {
      verificationStatus: "VERIFIED",
      topicId: { in: [...STAGE6_READY_TOPICS] },
    },
  });
  if (readyVerified !== 84) throw new Error(`Expected 84 VERIFIED in Stage 6 READY topics, got ${readyVerified}`);
}

async function main() {
  const mode = process.argv.includes("--production") ? "production" : "qa";
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const resolved = assertDatabaseTarget(databaseUrl, mode);
  console.log(JSON.stringify({ mode, resolvedPath: resolved }, null, 2));

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const baselineVerifiedTotal = await prisma.question.count({
      where: { verificationStatus: "VERIFIED" },
    });
    await preflightTopics(prisma);
    const reports = await importManifest(prisma);
    await verifyAfterImport(prisma, baselineVerifiedTotal);
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode,
          packages: reports.length,
          questionsCreated: reports.reduce((n, r) => n + r.counts.questionsToCreate, 0),
          topicsUpdated: reports.reduce((n, r) => n + r.counts.topicsToUpdate, 0),
          topicsCreated: reports.reduce((n, r) => n + r.counts.topicsToCreate, 0),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
