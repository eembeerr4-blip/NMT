/** Read-only Stage 7 content gate; reuse the import-normalized release check. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { STAGE7_PRODUCTION_DB } from "./stage7-final-production-path.mjs";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, [
  path.join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
  path.join(repoRoot, "scripts/stage7-production-release-gate.ts"),
  STAGE7_PRODUCTION_DB,
], { cwd: repoRoot, stdio: "inherit" });
process.exitCode = result.status ?? 1;
