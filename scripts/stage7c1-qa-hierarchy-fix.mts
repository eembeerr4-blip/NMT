/**
 * QA-only: reparent legacy curriculum children so fill-existing section topics become publishable leaves.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { assertStage7aQaDatabase } from "../src/lib/stage7a-production-guard";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7c/stage7c-hierarchy-fix.v1.json"), "utf8"),
);

async function main() {
  if (process.env.STAGE7C1_QA_HIERARCHY !== "yes") {
    throw new Error("Set STAGE7C1_QA_HIERARCHY=yes to run hierarchy fix on QA DB only");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  assertStage7aQaDatabase(databaseUrl, repoRoot);

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const results: { childId: string; from: string | null; to: string }[] = [];
    await prisma.$transaction(async (tx) => {
      for (const op of plan.operations) {
        if (op.type !== "reparent") continue;
        const parent = await tx.topic.findUnique({ where: { id: op.newParentId } });
        if (!parent) throw new Error(`Missing new parent ${op.newParentId}`);
        for (const childId of op.childIds) {
          const child = await tx.topic.findUnique({ where: { id: childId } });
          if (!child) throw new Error(`Missing child ${childId}`);
          if (child.parentId !== op.fromParentId) {
            throw new Error(
              `Child ${childId} parentId=${child.parentId}, expected ${op.fromParentId}`,
            );
          }
          await tx.topic.update({
            where: { id: childId },
            data: { parentId: op.newParentId },
          });
          results.push({ childId, from: op.fromParentId, to: op.newParentId });
        }
      }
    });
    console.log(JSON.stringify({ ok: true, reparented: results.length, results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
