import { accessSync, constants, existsSync } from "node:fs";
import path from "node:path";

/** Fail fast with a clear message when e2e.db is locked (e.g. dev server on 3010). */
export function assertE2eDbWritable() {
  const dbPath = path.join(process.cwd(), "prisma", "e2e.db");
  if (!existsSync(dbPath)) return;
  try {
    accessSync(dbPath, constants.W_OK);
  } catch {
    throw new Error(
      "prisma/e2e.db is not writable (likely locked by another Node/Next process on port 3010). Stop that process before running Playwright E2E.",
    );
  }
}
