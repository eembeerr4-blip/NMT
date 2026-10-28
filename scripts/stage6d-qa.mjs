import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const manifestV2 = JSON.parse(readFileSync(path.join(root, "content/stage6b/stage6b-question-bank-manifest.v2.json"), "utf8"));
const videoManifest = JSON.parse(readFileSync(path.join(root, "content/stage6c/stage6c-video-candidates.v1.json"), "utf8"));
const rehearsal = JSON.parse(readFileSync(path.join(root, "content/stage6d/stage6d-rehearsal-report.json"), "utf8"));
const html = readFileSync(path.join(root, "content/stage6d/stage6d-release-review.html"), "utf8");
const plan = JSON.parse(readFileSync(path.join(root, "content/stage6d/stage6d-release-plan.v1.json"), "utf8"));

if (manifestV2.version !== 2) errors.push("manifest v2 version");
if (videoManifest.lessons.length !== 7) errors.push("video lessons");
if (!rehearsal.apply?.idempotencyOk) errors.push("rehearsal idempotency");
if (rehearsal.errors?.length) errors.push("rehearsal errors");
if (!html.includes("stage6b2-owner-decisions")) errors.push("b62 import hook");
if (!html.includes("contentHash")) errors.push("hash check mention");
if (!html.includes("appliedToDatabase: false")) errors.push("export safety flag");
if (plan.orderedSteps.length !== 10) errors.push("release plan steps");

const workingDb = "D:/НМТ Сайт/NMT-academy/prisma/dev.db";
const working = statSync(workingDb);
const unchangedWorking =
  working.size === rehearsal.workingDatabase.sizeBefore &&
  Math.abs(working.mtimeMs - new Date(rehearsal.workingDatabase.mtimeBefore).getTime()) < 2000;

const report = {
  pass: errors.length === 0 && unchangedWorking,
  errors,
  rehearsalPass: rehearsal.errors.length === 0,
  videoPickCount: rehearsal.videoCandidates.picked.length,
  workingSqliteUnchanged: unchangedWorking,
  automaticVerified: false,
  automaticConfirmed: false,
};
writeFileSync(path.join(root, "content/stage6d/stage6d-qa.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exit(1);
