#!/usr/bin/env node
/**
 * CI-only structural check for content packages.
 * Does not import into any database and never opens production SQLite.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ROOTS = ["content", "docs/content/examples", "prisma/content"].filter((p) =>
  existsSync(join(ROOT, p)),
);

const errors = [];
let checked = 0;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(abs, out);
    } else if (name.endsWith(".package.json") || name.endsWith(".json")) {
      out.push(abs);
    }
  }
  return out;
}

for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    // Only enforce content-package contract on explicit package files + examples.
    const isPackage =
      rel.endsWith(".package.json") ||
      (rel.includes("/examples/") && rel.endsWith(".json"));
    if (!isPackage) continue;

    let json;
    try {
      json = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${rel}: invalid JSON (${error instanceof Error ? error.message : error})`);
      continue;
    }
    checked += 1;
    if (json.format !== "nmt-content-package") {
      // Non-package JSON under content/ is allowed; skip contract.
      if (!rel.endsWith(".package.json") && !rel.includes("/examples/")) continue;
      errors.push(`${rel}: expected format nmt-content-package`);
      continue;
    }
    if (json.version !== 1) errors.push(`${rel}: version must be 1`);
    if (!json.subjectId) errors.push(`${rel}: missing subjectId`);
    if (!json.provenance?.origin) errors.push(`${rel}: missing provenance.origin`);
    if (!Array.isArray(json.sections) || json.sections.length < 1) {
      errors.push(`${rel}: sections required`);
    }
  }
}

if (checked === 0) {
  console.log("No content packages found to validate (ok for sparse checkouts).");
  process.exit(0);
}

if (errors.length) {
  console.error("Content package validation failed:");
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Content package validation PASS (${checked} file(s)).`);
