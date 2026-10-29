import type { PrismaClient } from "@prisma/client";
import { assertStage7aQaDatabase, productionDevDbPath } from "@/lib/stage7a-production-guard";
import type { ContentPackageReport } from "@/lib/content-package";
import { applyContentPlan, reviewedPlan } from "./content-import-core";

export type Stage7aImportResult = {
  ok: boolean;
  error?: string;
  report?: ContentPackageReport;
  qaDatabasePath: string;
  productionDatabasePath: string;
};

/** Idempotent content-package import for Stage 7A QA only (no session, no revalidate, no audit). */
export async function importStage7aContentPackage(raw: string, db: PrismaClient): Promise<Stage7aImportResult> {
  const cwd = process.cwd();
  const productionDatabasePath = productionDevDbPath(cwd);
  const qaDatabasePath = assertStage7aQaDatabase(process.env.DATABASE_URL, cwd);

  try {
    const outcome = await db.$transaction(
      async (tx) => {
        const reviewed = await reviewedPlan(raw, tx);
        if (!reviewed.plan) {
          return { ok: false as const, error: reviewed.error, report: reviewed.report };
        }
        await applyContentPlan(tx, reviewed.plan);
        return { ok: true as const, report: reviewed.report };
      },
      { maxWait: 15000, timeout: 120000 },
    );
    return { ...outcome, qaDatabasePath, productionDatabasePath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      qaDatabasePath,
      productionDatabasePath,
    };
  }
}

/** Import all package files listed in the Stage 7A manifest (sequential, same transaction per file). */
export async function importStage7aManifestPackages(
  packages: { file: string; subjectId: string }[],
  readPackage: (relativeFile: string) => string,
  db: PrismaClient,
): Promise<Stage7aImportResult[]> {
  const results: Stage7aImportResult[] = [];
  for (const pkg of packages) {
    results.push(await importStage7aContentPackage(readPackage(pkg.file), db));
  }
  return results;
}
