/**
 * Production browser: verify allowlisted 120 + publish 10 via /admin (real server actions).
 */
import path from "node:path";
import { checkReleaseContent, assertReleaseQuestionsVerified } from "./stage7-production-release-gate";
import { openSync, writeSync, ftruncateSync, fsyncSync, closeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  STAGE7_PUBLISH_TOPIC_ORDER,
  type ReleaseSummary,
  type Stage7PublishTopicId,
  buildReleaseJson,
  loadReleaseAllowlist,
} from "./stage7-production-browser-release-lib";
import {
  loginAdmin,
  publishTopic,
  verifyAllowlistedQuestion,
  type BrowserReleaseConfig,
} from "./stage7-production-browser-release-browser";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.STAGE7_PRODUCTION_BASE_URL ?? "http://localhost:3000";
const password = process.env.STAGE7A1_OWNER_PASSWORD ?? "";
const adminPrefix = "/admin";
const limitRaw = process.env.STAGE7_RELEASE_VERIFY_LIMIT ?? "";
const verifyLimit = limitRaw ? Math.max(1, Number(limitRaw)) : undefined;

const manifestPath = path.join(repoRoot, "content/stage7c/stage7c-review-decisions.v2.json");
const { entries: allowlistEntriesRaw, questionIds: allowlistIds } = loadReleaseAllowlist(manifestPath);
const allowlistEntries = [...allowlistEntriesRaw].sort((a, b) => {
  const topicOrder =
    STAGE7_PUBLISH_TOPIC_ORDER.indexOf(a.topicId as Stage7PublishTopicId) -
    STAGE7_PUBLISH_TOPIC_ORDER.indexOf(b.topicId as Stage7PublishTopicId);
  if (topicOrder !== 0) return topicOrder;
  return a.questionId.localeCompare(b.questionId);
});

const browserConfig: BrowserReleaseConfig = { base, adminPrefix, allowlistIds };

async function main() {
  const databasePath = process.env.STAGE7_RELEASE_DATABASE;
  if (!databasePath || !path.isAbsolute(databasePath)) throw new Error("Explicit absolute STAGE7_RELEASE_DATABASE required");
  checkReleaseContent(repoRoot, databasePath);
  const summary: ReleaseSummary = {
    allowlistSize: allowlistIds.size,
    verifiedIds: [],
    alreadyVerifiedIds: [],
    failedIds: [],
    publishResults: [],
  };

  const publishOnly = process.env.STAGE7_RELEASE_PUBLISH_ONLY === "yes";
  if (publishOnly) {
    if (verifyLimit) throw new Error("Publish-only resume cannot be combined with a partial verification limit");
    assertReleaseQuestionsVerified(databasePath, allowlistIds);
    summary.alreadyVerifiedIds = [...allowlistIds];
  }
  const entriesToVerify = publishOnly ? [] : verifyLimit ? allowlistEntries.slice(0, verifyLimit) : allowlistEntries;

  const resultFd = process.env.STAGE7_RELEASE_RESULT ? openSync(process.env.STAGE7_RELEASE_RESULT, "wx") : undefined;
  const persist = (error?: string) => {
    if (resultFd === undefined) return;
    const json = JSON.stringify(buildReleaseJson(summary, error), null, 2);
    ftruncateSync(resultFd, 0);
    writeSync(resultFd, json, 0, "utf8");
    fsyncSync(resultFd);
  };
  persist();
  const browser = await chromium.launch({ channel: process.env.STAGE7_BROWSER_CHANNEL });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

  try {
    await loginAdmin(page, base, adminPrefix, password);

    for (const { questionId, topicId } of entriesToVerify) {
      await verifyAllowlistedQuestion(page, browserConfig, topicId, questionId, summary);
      persist();
      if (summary.failedIds.length > 0) break;
    }

    if (!verifyLimit && summary.failedIds.length === 0 && !releaseVerifyComplete(summary)) {
      summary.failedIds.push({
        id: "(allowlist)",
        error: "Allowlist verification incomplete after processing all entries",
      });
    }

    if (!verifyLimit && summary.failedIds.length === 0) {
      for (const topicId of STAGE7_PUBLISH_TOPIC_ORDER) {
        const ok = await publishTopic(page, browserConfig, topicId, summary);
        persist();
        if (!ok) break;
      }
    }
  } catch (error) {
    const payload = buildReleaseJson(summary, String(error));
    persist(String(error));
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  } finally {
    if (resultFd !== undefined) closeSync(resultFd);
    await browser.close();
  }

  const payload = buildReleaseJson(summary);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.ok ? 0 : 1;
}

function releaseVerifyComplete(summary: ReleaseSummary) {
  const done = new Set([...summary.verifiedIds, ...summary.alreadyVerifiedIds]);
  return done.size === summary.allowlistSize;
}

main();
