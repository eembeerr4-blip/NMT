import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSqliteFilePath } from "../src/lib/stage7a-production-guard";
import { STAGE7_PRODUCTION_DB } from "./stage7-final-production-path.mjs";
import { captureFingerprints } from "./stage7b-fingerprints.mjs";
import { STAGE7B_ALLOWLIST } from "./stage7b-allowlist.mjs";
import { lessonReadiness } from "../src/lib/readiness";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionPath = path.normalize(STAGE7_PRODUCTION_DB);

function shaFile(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertQaUrl(databaseUrl: string) {
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const resolved = resolveSqliteFilePath(databaseUrl, repoRoot);
  if (resolved === productionPath) {
    throw new Error(`Refused: DATABASE_URL is production dev.db (${resolved})`);
  }
  return resolved;
}

async function runHierarchy(databaseUrl: string) {
  const plan = JSON.parse(
    readFileSync(path.join(repoRoot, "content/stage7c/stage7c-hierarchy-fix.v1.json"), "utf8"),
  );
  const prisma = new (await import("@prisma/client")).PrismaClient({ datasourceUrl: databaseUrl });
  const results: { childId: string; to: string }[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const op of plan.operations) {
        if (op.type !== "reparent") continue;
        for (const childId of op.childIds) {
          const child = await tx.topic.findUnique({ where: { id: childId } });
          if (!child) throw new Error(`Missing child ${childId}`);
          if (child.parentId === op.newParentId) continue;
          if (child.parentId !== op.fromParentId) {
            throw new Error(`Child ${childId} parent=${child.parentId}, expected ${op.fromParentId}`);
          }
          await tx.topic.update({ where: { id: childId }, data: { parentId: op.newParentId } });
          results.push({ childId, to: op.newParentId });
        }
      }
    });
  } finally {
    await prisma.$disconnect();
  }
  return results;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const qaPath = assertQaUrl(databaseUrl!);
  const beforeProd = captureFingerprints(productionPath);
  const beforeQa = captureFingerprints(qaPath);

  const hierarchy = await runHierarchy(databaseUrl!);
  process.env.STAGE7C1_QA_APPLY = "yes";
  for (let i = 0; i < 2; i++) {
    execFileSync("npx", ["tsx", "scripts/stage7c-apply-corrections.mts"], {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl!, STAGE7C1_QA_APPLY: "yes" },
      stdio: "pipe",
      timeout: 180000,
      shell: true,
    });
  }

  const prisma = new (await import("@prisma/client")).PrismaClient({ datasourceUrl: databaseUrl });
  const readiness = [];
  for (const topicId of STAGE7B_ALLOWLIST) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { questions: true, videos: true, children: { select: { id: true } } },
    });
    if (!topic) throw new Error(`Missing topic ${topicId}`);
    readiness.push({ topicId, ready: lessonReadiness(topic).ready });
  }
  await prisma.$disconnect();

  const afterQa = captureFingerprints(qaPath);
  const afterProd = captureFingerprints(productionPath);

  const userDigestMatch =
    beforeQa.digests.User === afterQa.digests.User &&
    beforeQa.digests.StudyTask === afterQa.digests.StudyTask &&
    beforeQa.digests.UserTopicProgress === afterQa.digests.UserTopicProgress &&
    beforeQa.digests.TestAttempt === afterQa.digests.TestAttempt &&
    beforeQa.digests.Answer === afterQa.digests.Answer;

  console.log(
    JSON.stringify(
      {
        ok: userDigestMatch && readiness.every((r) => r.ready),
        qaPath,
        productionSha256: shaFile(productionPath),
        hierarchyReparented: hierarchy.length,
        idempotentApplyRuns: 2,
        readiness,
        userDataPreserved: userDigestMatch,
        stage6ReadyDigestUnchanged: beforeQa.digests.ReadyQuestions === afterQa.digests.ReadyQuestions,
        productionUserCountUnchanged: beforeProd.counts.User === afterProd.counts.User,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
