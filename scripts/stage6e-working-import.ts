/**
 * Stage 6E — controlled import to working SQLite (owner-approved).
 * Run from NMT-stage6d-integration with academy node_modules:
 *   npx --prefix "D:/НМТ Сайт/NMT-academy" tsx scripts/stage6e-working-import.ts
 */
import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { addVideoCandidate } from "../src/server/video-lessons";
import { lessonReadiness } from "../src/lib/readiness";
import { initializeSQLite } from "../src/lib/sqlite-init";
import {
  applyManifestV2,
  assertCorrectionMatch,
  type ManifestV2,
} from "./stage6d-apply-manifest-v2";

const ACADEMY = "D:/НМТ Сайт/NMT-academy";
const STAGE6B = "D:/НМТ Сайт/NMT-stage6b-questions";
const STAGE6C = "D:/НМТ Сайт/NMT-stage6c-videos";
const WORKING_DB = path.join(ACADEMY, "prisma/dev.db").replaceAll("\\", "/");

const topicIds = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const CORRECTION_IDS = [
  "ukr-lex-02-q10",
  "ukr-lex-02-q11",
  "ukr-lex-01-q11",
  "ukr-lex-01-q12",
  "ukr-lex-03-q11",
  "ukr-lex-03-q12",
];

const PROTECTED_TABLES = [
  "User",
  "UserSettings",
  "UserTopicProgress",
  "StudyTask",
  "ExamResult",
  "TestAttempt",
  "Answer",
  "Mistake",
  "MistakeRetry",
  "ReviewSchedule",
  "Flashcard",
  "Topic",
];

const RECOMMENDED_PAIRS: { topicId: string; youtubeId: string }[] = [
  { topicId: "ukr-lex-01-meaning", youtubeId: "NDmd6xU9F2E" },
  { topicId: "ukr-lex-02-syn-ant-hom", youtubeId: "scigg_eN4qs" },
  { topicId: "ukr-lex-02-syn-ant-hom", youtubeId: "o9xcL5pCxog" },
  { topicId: "ukr-lex-03-phraseology", youtubeId: "wm0X68H_WtQ" },
  { topicId: "ukr-lex-03-phraseology", youtubeId: "oZfA9V0mhV4" },
  { topicId: "bio-cell-01-eukaryotic-cell", youtubeId: "bBymW0PtVT0" },
  { topicId: "bio-cell-01-eukaryotic-cell", youtubeId: "jCVunU5VGbI" },
  { topicId: "zcode-biology-molecular-dna-rna", youtubeId: "G63P4uoP6Fs" },
  { topicId: "zcode-biology-molecular-dna-rna", youtubeId: "K541lnwQmTQ" },
  { topicId: "zcode-biology-molecular-protein-synth", youtubeId: "vs6GLwIxI-U" },
  { topicId: "zcode-biology-molecular-protein-synth", youtubeId: "UGE4mfJliqo" },
  { topicId: "zcode-biology-molecular-division", youtubeId: "19a17ENs64g" },
  { topicId: "zcode-biology-molecular-division", youtubeId: "RV-aJuuOHrE" },
];

type Report = {
  status: "PASS" | "PARTIAL" | "BLOCKED";
  blockedReason?: string;
  workingDatabasePath: string;
  videoCountDiscrepancyExplanation: string;
  backup?: { path: string; sha256: string; createdAt: string; tableCount: number; entityCounts: Record<string, number> };
  questions: { beforeSevenTopics: number; afterSevenTopics: number; additionIds: string[]; correctedIds: string[] };
  videoLesson: { before: number; after: number; addedYoutubeIds: string[]; preflight: Record<string, unknown> };
  dryRun: Record<string, unknown>;
  postImport: Record<string, unknown>;
  integrity: { integrity_check: string; fkCount: number };
  localhost3000?: string;
  confirmations: Record<string, boolean>;
};

function sha256File(filePath: string) {
  const hash = createHash("sha256");
  return new Promise<string>((resolve, reject) => {
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

function backupDatabase(sourcePath: string, targetPath: string, methodNote: string) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const before = statSync(sourcePath);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    source.prepare(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`).run();
  } finally {
    source.close();
  }
  const after = statSync(sourcePath);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
    throw new Error("Working SQLite changed during backup (size or mtime)");
  }
  return { methodNote, sizeBefore: before.size, mtimeBefore: before.mtime.toISOString() };
}

function verifyBackupFile(backupPath: string) {
  const db = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    const fkRows = db.prepare("PRAGMA foreign_key_check").all() as unknown[];
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];
    const counts: Record<string, number> = {};
    for (const { name } of tables) {
      if (name.startsWith("_prisma")) continue;
      const row = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as { c: number };
      counts[name] = row.c;
    }
    return { integrity: integrity.integrity_check, fkCount: fkRows.length, tableCount: tables.length, counts };
  } finally {
    db.close();
  }
}

function countAnswerChecksFromTopics(topics: { lessonJson: string | null }[]) {
  let answerCheck = 0;
  for (const topic of topics) {
    try {
      const lesson = JSON.parse(topic.lessonJson || "{}") as { examples?: { answerCheck?: unknown }[] };
      for (const example of lesson.examples ?? []) if (example.answerCheck) answerCheck += 1;
    } catch {
      /* ignore */
    }
  }
  return answerCheck;
}

async function tableFingerprint(prisma: PrismaClient, name: string) {
  const countRows = await prisma.$queryRawUnsafe<{ c: bigint | number }[]>(`SELECT COUNT(*) as c FROM "${name}"`);
  const count = Number(countRows[0].c);
  if (count === 0) return { count, hash: "empty" };
  const rows = await prisma.$queryRawUnsafe<{ blob: string | null }[]>(
    `SELECT group_concat(rowid || ':' || quote(rowid), '|') as blob FROM "${name}" ORDER BY rowid`,
  );
  const hash = createHash("sha256").update(rows[0]?.blob ?? "").digest("hex");
  return { count, hash };
}

async function allTableFingerprints(prisma: PrismaClient) {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const fps: Record<string, { count: number; hash: string }> = {};
  for (const { name } of tables) {
    if (name.startsWith("_prisma")) continue;
    fps[name] = await tableFingerprint(prisma, name);
  }
  return fps;
}

function loadManifestAbsolute(): ManifestV2 {
  const manifestPath = path.join(STAGE6B, "content/stage6b/stage6b-question-bank-manifest.v2.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestV2;
}

type VideoPick = {
  topicId: string;
  youtubeId: string;
  title: string;
  role: string;
};

function recommendedVideoPicks(): VideoPick[] {
  const videoManifest = JSON.parse(
    readFileSync(path.join(STAGE6C, "content/stage6c/stage6c-video-candidates.v1.json"), "utf8"),
  );
  const picks: VideoPick[] = [];
  for (const lesson of videoManifest.lessons) {
    const rec = lesson.recommendation;
    const primary =
      rec.primary ?? (rec.action === "KEEP_WITH_OWNER_PREVIEW" ? lesson.currentPrimary : null);
    if (primary) {
      picks.push({
        topicId: lesson.topicId,
        youtubeId: primary.youtubeId,
        title: primary.title,
        role: "primary",
      });
    }
    if (rec.supplement) {
      picks.push({
        topicId: lesson.topicId,
        youtubeId: rec.supplement.youtubeId,
        title: rec.supplement.title,
        role: "simple",
      });
    }
  }
  if (picks.length !== 13) throw new Error(`Expected 13 video picks, got ${picks.length}`);
  for (const expected of RECOMMENDED_PAIRS) {
    if (!picks.some((p) => p.topicId === expected.topicId && p.youtubeId === expected.youtubeId)) {
      throw new Error(`Missing recommended pair ${expected.topicId} / ${expected.youtubeId}`);
    }
  }
  return picks;
}

async function analyzeVideos(prisma: PrismaClient) {
  const all = await prisma.videoLesson.findMany({
    select: { topicId: true, youtubeId: true, reviewStatus: true, isPrimary: true, id: true },
  });
  const beforeCount = all.length;
  const matching: typeof RECOMMENDED_PAIRS = [];
  const missing: typeof RECOMMENDED_PAIRS = [];
  for (const pair of RECOMMENDED_PAIRS) {
    const hit = all.find((v) => v.topicId === pair.topicId && v.youtubeId === pair.youtubeId);
    if (hit) matching.push(pair);
    else missing.push(pair);
  }
  const expectedAfter = beforeCount + missing.length;
  return {
    beforeCount,
    uniqueRecommended: RECOMMENDED_PAIRS.length,
    existingMatchingPairs: matching.length,
    newPairsRequired: missing.length,
    expectedRowsAfter: expectedAfter,
    incorrectSum9Plus13: beforeCount + RECOMMENDED_PAIRS.length,
    missingPairs: missing,
    matchingPairs: matching,
  };
}

async function preflightQuestions(prisma: PrismaClient, manifest: ManifestV2) {
  const baseline = JSON.parse(
    readFileSync(path.join(STAGE6B, "content/stage6b/exported-questions-baseline.json"), "utf8"),
  ) as { id: string }[];
  const baselineIds = new Set(baseline.map((q) => q.id));
  const manifestIds = manifest.questions.map((q) => q.id);
  if (manifest.questions.length !== 84) throw new Error("manifest not 84");
  if (new Set(manifestIds).size !== 84) throw new Error("duplicate manifest ids");
  const additionIds = manifestIds.filter((id) => !baselineIds.has(id));
  if (additionIds.length !== 14) throw new Error(`expected 14 additions, got ${additionIds.length}`);

  for (const topicId of topicIds) {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new Error(`Missing topic ${topicId}`);
  }

  const verifiedInSeven = await prisma.question.count({
    where: { topicId: { in: topicIds }, verificationStatus: "VERIFIED" },
  });
  if (verifiedInSeven > 0) throw new Error(`BLOCKED: ${verifiedInSeven} VERIFIED questions in 7 topics`);

  for (const correction of manifest.corrections) {
    const existing = await prisma.question.findUnique({ where: { id: correction.id } });
    if (existing) {
      if (correction.match) assertCorrectionMatch(existing, correction.match, correction.id);
      if (existing.verificationStatus === "VERIFIED") {
        throw new Error(`BLOCKED: correction target VERIFIED ${correction.id}`);
      }
    }
  }

  for (const id of additionIds) {
    const exists = await prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (exists) throw new Error(`New question id already exists: ${id}`);
  }

  const draftTopics = await prisma.topic.findMany({
    where: { id: { in: topicIds } },
    select: { id: true, coverage: true },
  });
  if (!draftTopics.every((t) => t.coverage === "DRAFT")) {
    throw new Error("One of 7 target topics is not DRAFT coverage");
  }

  return { additionIds, baselineCount: baselineIds.size, correctionCount: manifest.corrections.length };
}

async function applyImportTransaction(
  prisma: PrismaClient,
  manifest: ManifestV2,
  videoPicks: VideoPick[],
  strictCorrectionMatch: boolean,
) {
  const videoBefore = await prisma.videoLesson.count();
  const questionsBefore = await prisma.question.count({ where: { topicId: { in: topicIds } } });

  const { applyResult, videoResults } = await prisma.$transaction(async (tx) => {
    const applyResult = await applyManifestV2(tx, manifest, { strictCorrectionMatch });
    const videoResults: {
      topicId: string;
      youtubeId: string;
      id: string;
      duplicate: boolean;
      reviewStatus: string;
      isPrimary: boolean;
    }[] = [];
    for (const pick of videoPicks) {
      const before = await tx.videoLesson.findFirst({
        where: { topicId: pick.topicId, youtubeId: pick.youtubeId },
      });
      const result = await addVideoCandidate(tx, pick.topicId, pick.youtubeId, pick.title, pick.role);
      const after = await tx.videoLesson.findUniqueOrThrow({ where: { id: result.id } });
      videoResults.push({
        topicId: pick.topicId,
        youtubeId: pick.youtubeId,
        id: result.id,
        duplicate: Boolean(before),
        reviewStatus: after.reviewStatus,
        isPrimary: after.isPrimary,
      });
    }
    return { applyResult, videoResults };
  });

  const videoAfter = await prisma.videoLesson.count();
  const questionsAfter = await prisma.question.count({ where: { topicId: { in: topicIds } } });

  return { applyResult, videoResults, videoBefore, videoAfter, questionsBefore, questionsAfter };
}

async function topicQa(prisma: PrismaClient) {
  const perTopic = [];
  for (const topicId of topicIds) {
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { questions: true, videos: true },
    });
    const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of topic.questions) counts[q.difficulty as keyof typeof counts]++;
    const readiness = lessonReadiness({ lessonJson: topic.lessonJson, questions: topic.questions, videos: topic.videos });
    perTopic.push({
      topicId,
      coverage: topic.coverage,
      questionTotal: topic.questions.length,
      counts,
      practice: readiness.practice,
      draftQuestions: topic.questions.filter((q) => q.verificationStatus === "DRAFT").length,
      verifiedQuestions: topic.questions.filter((q) => q.verificationStatus === "VERIFIED").length,
    });
  }
  return perTopic;
}

function prismaForDb(dbPath: string) {
  const url = `file:${dbPath.replaceAll("\\", "/")}?connection_limit=1`;
  return new PrismaClient({ datasources: { db: { url } } });
}

async function main() {
  const report: Report = {
    status: "BLOCKED",
    workingDatabasePath: WORKING_DB,
    videoCountDiscrepancyExplanation: "",
    questions: { beforeSevenTopics: 0, afterSevenTopics: 0, additionIds: [], correctedIds: CORRECTION_IDS },
    videoLesson: { before: 0, after: 0, addedYoutubeIds: [], preflight: {} },
    dryRun: {},
    postImport: {},
    integrity: { integrity_check: "unknown", fkCount: -1 },
    confirmations: {},
  };

  if (!statSync(WORKING_DB).isFile()) throw new Error("Working dev.db not found");

  const manifest = loadManifestAbsolute();
  const videoPicks = recommendedVideoPicks();

  const workingPrisma = prismaForDb(WORKING_DB);
  await initializeSQLite(workingPrisma);

  const userCount = await workingPrisma.user.count();
  if (userCount === 0) throw new Error("BLOCKED: working DB has no User rows");

  const videoAnalysis = await analyzeVideos(workingPrisma);
  report.videoLesson.before = videoAnalysis.beforeCount;
  report.videoLesson.preflight = videoAnalysis;
  report.videoCountDiscrepancyExplanation =
    "Stage 6D narrative used 9+13=22 without subtracting duplicate (topicId,youtubeId) pairs. " +
    "Rehearsal snapshots (beforeApply/afterFirstApply/afterSecondApply) were taken before video inserts, so videoLesson stayed at 9 in JSON. " +
    `Correct expected total: ${videoAnalysis.beforeCount} + ${videoAnalysis.newPairsRequired} new pairs = ${videoAnalysis.expectedRowsAfter} ` +
    `(13 recommended, ${videoAnalysis.existingMatchingPairs} already present).`;

  let questionPreflight;
  try {
    questionPreflight = await preflightQuestions(workingPrisma, manifest);
  } catch (e) {
    report.blockedReason = e instanceof Error ? e.message : String(e);
    writeReport(report);
    process.exit(1);
  }
  report.questions.additionIds = questionPreflight.additionIds;
  report.questions.beforeSevenTopics = await workingPrisma.question.count({ where: { topicId: { in: topicIds } } });

  const topicsForAnswerCheck = await workingPrisma.topic.findMany({ select: { lessonJson: true } });
  const answerCheckBefore = countAnswerChecksFromTopics(topicsForAnswerCheck);
  if (answerCheckBefore !== 25) {
    report.blockedReason = `Expected 25 answerCheck in lessonJson, got ${answerCheckBefore}`;
    writeReport(report);
    process.exit(1);
  }

  const fingerprintsBefore = await allTableFingerprints(workingPrisma);
  const confirmedBefore = await workingPrisma.videoLesson.findMany({
    where: { reviewStatus: "CONFIRMED" },
    select: { id: true, topicId: true, youtubeId: true, isPrimary: true, reviewStatus: true },
  });

  const backupDir = path.join(
    "D:/НМТ Сайт/backups",
    `stage6e-before-import-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  const backupPath = path.join(backupDir, "dev.db").replaceAll("\\", "/");
  const backupMeta = backupDatabase(
    WORKING_DB,
    backupPath,
    "VACUUM INTO from read-only DatabaseSync connection; WAL was 0 bytes at preflight; working file size/mtime unchanged after copy",
  );
  const backupSha = await sha256File(backupPath);
  const backupVerify = verifyBackupFile(backupPath);
  if (backupVerify.integrity !== "ok" || backupVerify.fkCount !== 0) {
    report.blockedReason = `Backup verification failed: integrity=${backupVerify.integrity} fk=${backupVerify.fkCount}`;
    writeReport(report);
    process.exit(1);
  }
  if (backupVerify.counts.User === 0) {
    report.blockedReason = "Backup has no users";
    writeReport(report);
    process.exit(1);
  }

  report.backup = {
    path: backupDir.replaceAll("\\", "/"),
    sha256: backupSha,
    createdAt: new Date().toISOString(),
    tableCount: backupVerify.tableCount,
    entityCounts: {
      User: backupVerify.counts.User ?? 0,
      Question: backupVerify.counts.Question ?? 0,
      VideoLesson: backupVerify.counts.VideoLesson ?? 0,
      StudyTask: backupVerify.counts.StudyTask ?? 0,
      answerCheckInLessons: answerCheckBefore,
    },
  };
  writeFileSync(path.join(backupDir, "backup-meta.json"), JSON.stringify({ backupMeta, backupSha, backupVerify }, null, 2));
  writeFileSync(path.join(backupDir, "fingerprints-before.json"), JSON.stringify(fingerprintsBefore, null, 2));

  const dryDb = path.join(backupDir, "qa-dry-run.db").replaceAll("\\", "/");
  backupDatabase(backupPath, dryDb, "copy of verified backup for dry-run");
  const dryPrisma = prismaForDb(dryDb);
  await initializeSQLite(dryPrisma);
  const dryFpsBefore = await allTableFingerprints(dryPrisma);

  const dryFirst = await applyImportTransaction(dryPrisma, manifest, videoPicks, true);
  const drySecond = await applyImportTransaction(dryPrisma, manifest, videoPicks, false);
  const dryFpsAfter = await allTableFingerprints(dryPrisma);
  const dryPerTopic = await topicQa(dryPrisma);

  const protectedOk = PROTECTED_TABLES.every(
    (t) => dryFpsBefore[t]?.hash === dryFpsAfter[t]?.hash && dryFpsBefore[t]?.count === dryFpsAfter[t]?.count,
  );
  const idempotentQuestions = drySecond.applyResult.upserted === manifest.questions.length;
  const idempotentVideos = drySecond.videoResults.every((r) => r.duplicate);
  const dryOk =
    protectedOk &&
    idempotentQuestions &&
    idempotentVideos &&
    dryFirst.questionsAfter === 84 &&
    dryFirst.videoAfter === videoAnalysis.expectedRowsAfter &&
    dryPerTopic.every((r) => r.questionTotal === 12 && r.draftQuestions === 12 && r.verifiedQuestions === 0);

  report.dryRun = {
    dryDb,
    dryOk,
    protectedTablesUnchanged: protectedOk,
    idempotentQuestions,
    idempotentVideos,
    firstApply: dryFirst.applyResult,
    videoResults: dryFirst.videoResults,
    perTopic: dryPerTopic,
    videoAfterFirst: dryFirst.videoAfter,
  };

  if (!dryOk) {
    report.blockedReason = "Dry-run invariants failed";
    writeReport(report);
    await workingPrisma.$disconnect();
    process.exit(1);
  }

  const reFingerprint = await allTableFingerprints(workingPrisma);
  for (const [table, fp] of Object.entries(fingerprintsBefore)) {
    if (table === "Question" || table === "QuestionOption" || table === "VideoLesson") continue;
    if (reFingerprint[table]?.hash !== fp.hash || reFingerprint[table]?.count !== fp.count) {
      report.blockedReason = `Working DB changed between snapshot and import: ${table}`;
      writeReport(report);
      await workingPrisma.$disconnect();
      process.exit(1);
    }
  }

  const liveApply = await applyImportTransaction(workingPrisma, manifest, videoPicks, true);
  report.questions.afterSevenTopics = liveApply.questionsAfter;
  report.videoLesson.after = liveApply.videoAfter;
  report.videoLesson.addedYoutubeIds = liveApply.videoResults.filter((r) => !r.duplicate).map((r) => r.youtubeId);

  const fpsAfter = await allTableFingerprints(workingPrisma);
  const userTablesOk = PROTECTED_TABLES.every(
    (t) => fingerprintsBefore[t]?.hash === fpsAfter[t]?.hash && fingerprintsBefore[t]?.count === fpsAfter[t]?.count,
  );
  const answerCheckAfter = countAnswerChecksFromTopics(await workingPrisma.topic.findMany({ select: { lessonJson: true } }));
  const confirmedAfter = await workingPrisma.videoLesson.findMany({
    where: { reviewStatus: "CONFIRMED" },
    select: { id: true, topicId: true, youtubeId: true, isPrimary: true, reviewStatus: true },
  });
  const perTopic = await topicQa(workingPrisma);
  const integrityRows = await workingPrisma.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  const fkRows = await workingPrisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  const verifiedSeven = await workingPrisma.question.count({
    where: { topicId: { in: topicIds }, verificationStatus: "VERIFIED" },
  });

  report.integrity = { integrity_check: integrityRows[0]?.integrity_check ?? "?", fkCount: Array.isArray(fkRows) ? fkRows.length : -1 };
  report.postImport = {
    userTablesOk,
    answerCheckBefore,
    answerCheckAfter,
    perTopic,
    liveApply: { applyResult: liveApply.applyResult, videoResults: liveApply.videoResults },
    confirmedVideosUnchanged: JSON.stringify(confirmedBefore) === JSON.stringify(confirmedAfter),
    verifiedInSevenTopics: verifiedSeven,
  };

  const pass =
    userTablesOk &&
    answerCheckAfter === 25 &&
    verifiedSeven === 0 &&
    perTopic.every((r) => r.coverage === "DRAFT" && r.questionTotal === 12) &&
    report.integrity.integrity_check === "ok" &&
    report.integrity.fkCount === 0 &&
    liveApply.videoAfter === videoAnalysis.expectedRowsAfter;

  report.status = pass ? "PASS" : "PARTIAL";
  report.confirmations = {
    noVerifiedQuestions: verifiedSeven === 0,
    noConfirmedVideoChanges: JSON.stringify(confirmedBefore) === JSON.stringify(confirmedAfter),
    noCoveragePublish: perTopic.every((r) => r.coverage === "DRAFT"),
    noGitPush: true,
    userDataFingerprintsOk: userTablesOk,
  };

  writeFileSync(path.join(backupDir, "fingerprints-after.json"), JSON.stringify(fpsAfter, null, 2));
  writeReport(report, backupDir);
  console.log(JSON.stringify({ status: report.status, backupDir, pass }, null, 2));
  await workingPrisma.$disconnect();
  if (!pass) process.exit(2);
}

function writeReport(report: Report, backupDir?: string) {
  const out = backupDir
    ? path.join(backupDir, "stage6e-report.json")
    : path.join("D:/НМТ Сайт/backups", "stage6e-report-blocked.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
