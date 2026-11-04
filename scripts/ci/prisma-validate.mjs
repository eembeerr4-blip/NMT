#!/usr/bin/env node
/**
 * Validate Prisma schema without touching working/production SQLite.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "nmt-prisma-validate-"));
const db = join(dir, "ci-validate.db");
writeFileSync(db, "");
const url = "file:" + db.replaceAll("\\", "/");

const result = spawnSync(
  process.execPath,
  [join(process.cwd(), "node_modules/prisma/build/index.js"), "validate"],
  {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  },
);

process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
rmSync(dir, { recursive: true, force: true });
process.exit(result.status ?? 1);
