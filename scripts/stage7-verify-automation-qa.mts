/**
 * Isolated QA browser check for verify automation (never prisma/dev.db).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import {
  buildReleaseJson,
  loadReleaseAllowlist,
  type ReleaseSummary,
} from "./stage7-production-browser-release-lib";
import {
  loginAdmin,
  verifyAllowlistedQuestion,
  type BrowserReleaseConfig,
} from "./stage7-production-browser-release-browser";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaDb = path.resolve(repoRoot, "prisma/stage7-verify-automation-qa.db");
const prodDb = path.resolve("D:/НМТ Сайт/NMT-academy/prisma/dev.db");

if (process.env.STAGE7_VERIFY_AUTOMATION_QA !== "yes") {
  throw new Error("Set STAGE7_VERIFY_AUTOMATION_QA=yes to run isolated QA browser check");
}

const base = process.env.STAGE7_PRODUCTION_BASE_URL ?? "http://127.0.0.1:3011";
const password = process.env.STAGE7A1_OWNER_PASSWORD ?? "";
const firstId = "s7a-ukr-lexicology-section-01-e01";

function assertSafeDb() {
  const db = new DatabaseSync(qaDb, { readOnly: true });
  db.close();
  if (path.normalize(qaDb) === path.normalize(prodDb)) {
    throw new Error("Refusing to run QA automation against production dev.db");
  }
}

assertSafeDb();

const manifestPath = path.join(repoRoot, "content/stage7c/stage7c-review-decisions.v2.json");
const { entries, questionIds } = loadReleaseAllowlist(manifestPath);
const first = entries.find((e) => e.questionId === firstId);
if (!first) throw new Error(`Missing allowlist entry ${firstId}`);
const target = first;

const browserConfig: BrowserReleaseConfig = {
  base,
  adminPrefix: "/admin",
  allowlistIds: questionIds,
};

async function runPass(label: string, summary: ReleaseSummary) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  try {
    await loginAdmin(page, base, "/admin", password);
    await verifyAllowlistedQuestion(page, browserConfig, target.topicId, target.questionId, summary);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ pass: label, result: buildReleaseJson(summary) }, null, 2));
}

async function readQuestionStatus(id: string) {
  const db = new DatabaseSync(qaDb, { readOnly: true });
  const row = db.prepare(`SELECT verificationStatus FROM Question WHERE id = ?`).get(id) as
    | { verificationStatus: string }
    | undefined;
  db.close();
  return row?.verificationStatus ?? "MISSING";
}

async function main() {
  const pass1: ReleaseSummary = {
    allowlistSize: questionIds.size,
    verifiedIds: [],
    alreadyVerifiedIds: [],
    failedIds: [],
    publishResults: [],
  };
  await runPass("first-verify", pass1);
  const statusAfterFirst = await readQuestionStatus(firstId);

  const pass2: ReleaseSummary = {
    allowlistSize: questionIds.size,
    verifiedIds: [],
    alreadyVerifiedIds: [],
    failedIds: [],
    publishResults: [],
  };
  await runPass("idempotent-rerun", pass2);
  const statusAfterSecond = await readQuestionStatus(firstId);

  console.log(
    JSON.stringify(
      {
        qaDb: qaDb.replace(/\\/g, "/"),
        questionId: firstId,
        dbStatusAfterFirst: statusAfterFirst,
        dbStatusAfterSecond: statusAfterSecond,
        pass1Ok: buildReleaseJson(pass1).ok || pass1.verifiedIds.length === 1,
        pass2AlreadyVerified: pass2.alreadyVerifiedIds.includes(firstId),
      },
      null,
      2,
    ),
  );

  if (pass1.failedIds.length > 0 || pass1.verifiedIds.length !== 1) process.exit(1);
  if (!pass2.alreadyVerifiedIds.includes(firstId)) process.exit(1);
}

main();
