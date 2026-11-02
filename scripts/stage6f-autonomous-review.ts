/**
 * Stage 6F — autonomous review pipeline (backup, QA dry-run, optional apply).
 * Run: npx --prefix "D:/НМТ Сайт/NMT-academy" tsx scripts/stage6f-autonomous-review.ts [--apply]
 * Default: review + QA only (no working DB writes). --apply after owner-approved autonomous run.
 */
import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { prepareQuestion } from "../src/lib/question-input";
import { lessonReadiness } from "../src/lib/readiness";
import { reconcileVideoPrimary } from "../src/server/video-lessons";
import { initializeSQLite } from "../src/lib/sqlite-init";

const ACADEMY = "D:/НМТ Сайт/NMT-academy";
const WORKING_DB = path.join(ACADEMY, "prisma/dev.db").replaceAll("\\", "/");
const STAGE6B_MANIFEST = "D:/НМТ Сайт/NMT-stage6b-questions/content/stage6b/stage6b-question-bank-manifest.v2.json";
const STAGE6C_MANIFEST = "D:/НМТ Сайт/NMT-stage6c-videos/content/stage6c/stage6c-video-candidates.v1.json";

const topicIds = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const RECOMMENDED: { topicId: string; youtubeId: string }[] = [
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

type ReviewResult =
  | "VERIFIED_CANDIDATE"
  | "FIX_REQUIRED"
  | "REJECT_REQUIRED"
  | "UNVERIFIABLE";

type QuestionReview = {
  questionId: string;
  result: ReviewResult;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  facts: string;
  sources: string[];
  problems: string[];
  fixes: string[];
  finalDecision: "VERIFIED" | "DRAFT";
};

type VideoReview = {
  topicId: string;
  youtubeId: string;
  videoId: string | null;
  verificationLevel: string;
  result: "CONFIRMED_CANDIDATE" | "SUGGESTED_ONLY";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  blockers: string[];
  primaryCandidate: boolean;
};

function sha256File(filePath: string) {
  const hash = createHash("sha256");
  return new Promise<string>((resolve, reject) => {
    createReadStream(filePath)
      .on("data", (c) => hash.update(c))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

function backupDb(source: string, target: string) {
  mkdirSync(path.dirname(target), { recursive: true });
  const before = statSync(source);
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    db.prepare(`VACUUM INTO '${target.replace(/'/g, "''")}'`).run();
  } finally {
    db.close();
  }
  const after = statSync(source);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
    throw new Error("Source DB changed during backup");
  }
}

function verifyBackupFile(backupPath: string) {
  const db = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const integrity = (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
    const fk = db.prepare("PRAGMA foreign_key_check").all().length;
    return { integrity, fkCount: fk };
  } finally {
    db.close();
  }
}

function prismaFor(dbPath: string) {
  return new PrismaClient({
    datasources: { db: { url: `file:${dbPath.replaceAll("\\", "/")}?connection_limit=1` } },
  });
}

function loadManifestV2() {
  return JSON.parse(readFileSync(STAGE6B_MANIFEST, "utf8")) as {
    corrections: { id: string; question: unknown; sources?: { title: string; url: string }[] }[];
    questions: Array<{ id: string; origin?: string; changedInV2?: boolean; prompt: string }>;
    biologyRecheck: { questionId: string; confirmed: string[]; notClaimed: string };
  };
}

function loadStage6cLevels(): Map<string, string> {
  const manifest = JSON.parse(readFileSync(STAGE6C_MANIFEST, "utf8"));
  const map = new Map<string, string>();
  for (const lesson of manifest.lessons) {
    const scan = (v: { youtubeId?: string; verificationLevel?: string } | null | undefined) => {
      if (v?.youtubeId && v.verificationLevel) map.set(`${lesson.topicId}:${v.youtubeId}`, v.verificationLevel);
    };
    scan(lesson.currentPrimary);
    scan(lesson.recommendation?.primary);
    scan(lesson.recommendation?.supplement);
    for (const alt of lesson.alternatives ?? []) scan(alt);
  }
  return map;
}

async function tableFingerprint(prisma: PrismaClient, name: string) {
  const count = Number((await prisma.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*) as c FROM "${name}"`))[0].c);
  if (count === 0) return { count, hash: "empty" };
  const rows = await prisma.$queryRawUnsafe<{ blob: string | null }[]>(
    `SELECT group_concat(rowid || ':' || quote(rowid), '|') as blob FROM "${name}" ORDER BY rowid`,
  );
  const hash = createHash("sha256").update(rows[0]?.blob ?? "").digest("hex");
  return { count, hash };
}

async function protectedFingerprints(prisma: PrismaClient) {
  const names = [
    "User",
    "UserSettings",
    "StudyTask",
    "TestAttempt",
    "Answer",
    "Mistake",
    "MistakeRetry",
    "ReviewSchedule",
    "ExamResult",
    "Flashcard",
    "UserTopicProgress",
    "Topic",
  ];
  const out: Record<string, { count: number; hash: string }> = {};
  for (const n of names) out[n] = await tableFingerprint(prisma, n);
  return out;
}

function reviewQuestionRow(
  q: Awaited<ReturnType<typeof loadQuestions>>[number],
  manifest: ReturnType<typeof loadManifestV2>,
): QuestionReview {
  const problems: string[] = [];
  const fixes: string[] = [];
  const sources: string[] = [];
  try {
    prepareQuestion({ ...q, options: q.options }, { preserveIds: true });
  } catch (e) {
    return {
      questionId: q.id,
      result: "FIX_REQUIRED",
      confidence: "HIGH",
      facts: "prepareQuestion validation failed",
      sources,
      problems: [e instanceof Error ? e.message : String(e)],
      fixes: ["Fix schema/options/correctAnswer"],
      finalDecision: "DRAFT",
    };
  }

  const manifestQ = manifest.questions.find((m) => m.id === q.id);
  const correction = manifest.corrections.find((c) => c.id === q.id);
  const isCorrection = Boolean(correction);
  const isBiologyRecheck = q.id === manifest.biologyRecheck.questionId;

  if (isCorrection && correction?.sources?.length) {
    for (const s of correction.sources) sources.push(`${s.title}: ${s.url}`);
  }
  if (isBiologyRecheck) {
    sources.push("Stage 6B.2 manifest biologyRecheck (triplet/stop-codon reasoning)");
  }

  // Subject verification policy: only corrections with manifest dictionary sources + biology q08 numeric check
  // get VERIFIED_CANDIDATE with MEDIUM confidence. All others UNVERIFIABLE without full dictionary/session review.
  if (isCorrection) {
    const mq = correction!.question as { prompt: string; explanation: string };
    if (q.prompt !== mq.prompt) problems.push("DB prompt differs from manifest correction");
    return {
      questionId: q.id,
      result: problems.length ? "FIX_REQUIRED" : "VERIFIED_CANDIDATE",
      confidence: problems.length ? "LOW" : "MEDIUM",
      facts: "Stage 6B.2 correction with cited SUM/VTSSUM sources in manifest; text matches manifest v2",
      sources,
      problems,
      fixes,
      finalDecision: problems.length ? "DRAFT" : "VERIFIED",
    };
  }

  if (isBiologyRecheck) {
    const hasUkr = q.prompt.includes("Кодуюча") || q.prompt.includes("непереклад");
    if (!hasUkr) problems.push("Expected Ukrainian wording in protein-synth-q08");
    return {
      questionId: q.id,
      result: problems.length ? "FIX_REQUIRED" : "VERIFIED_CANDIDATE",
      confidence: "MEDIUM",
      facts: manifest.biologyRecheck.confirmed.join(" "),
      sources,
      problems,
      fixes,
      finalDecision: problems.length ? "DRAFT" : "VERIFIED",
    };
  }

  return {
    questionId: q.id,
    result: "UNVERIFIABLE",
    confidence: "LOW",
    facts: "Technical validation OK; full NMT/subject review with authoritative sources not completed in this autonomous pass",
    sources: ["Internal: prepareQuestion + lesson alignment not fully audited per item"],
    problems: [],
    fixes: [],
    finalDecision: "DRAFT",
  };
}

async function loadQuestions(prisma: PrismaClient) {
  return prisma.question.findMany({
    where: { topicId: { in: topicIds } },
    include: { options: { orderBy: { sortOrder: "asc" } } },
    orderBy: { id: "asc" },
  });
}

function reviewVideos(
  videos: { id: string; topicId: string; youtubeId: string; reviewStatus: string }[],
  levels: Map<string, string>,
): VideoReview[] {
  const stage6cLimits = [
    "Stage 6C: no full watch; Ukrainian audio not listened",
    "Partial public text ≠ full roll review",
  ];
  return RECOMMENDED.map((pair) => {
    const row = videos.find((v) => v.topicId === pair.topicId && v.youtubeId === pair.youtubeId);
    const level = levels.get(`${pair.topicId}:${pair.youtubeId}`) ?? "UNKNOWN";
    const blockers = [...stage6cLimits];
    if (level === "METADATA_ONLY") blockers.push("METADATA_ONLY — content/audio not verified");
    if (level === "VERIFIED_CONTENT") {
      blockers.push("VERIFIED_CONTENT in 6C = partial public text only; no audio listen in 6C or 6F");
    }
    // Owner rule + 6C researchLimitations: cannot CONFIRM without full content + Ukrainian audio verification
    return {
      topicId: pair.topicId,
      youtubeId: pair.youtubeId,
      videoId: row?.id ?? null,
      verificationLevel: level,
      result: "SUGGESTED_ONLY",
      confidence: "LOW",
      blockers,
      primaryCandidate: false,
    };
  });
}

async function applyPlan(
  prisma: PrismaClient,
  questionReviews: QuestionReview[],
  videoReviews: VideoReview[],
) {
  const toVerify = questionReviews.filter(
    (r) => r.finalDecision === "VERIFIED" && r.result === "VERIFIED_CANDIDATE" && r.confidence !== "LOW",
  );
  const toConfirm = videoReviews.filter((v) => v.result === "CONFIRMED_CANDIDATE");

  await prisma.$transaction(async (tx) => {
    for (const r of toVerify) {
      const question = await tx.question.findUniqueOrThrow({
        where: { id: r.questionId },
        include: { options: true },
      });
      if (question.verificationStatus === "VERIFIED") continue;
      prepareQuestion(question, { preserveIds: true });
      await tx.question.update({ where: { id: r.questionId }, data: { verificationStatus: "VERIFIED" } });
    }
    for (const v of toConfirm) {
      if (!v.videoId) continue;
      const video = await tx.videoLesson.findUniqueOrThrow({ where: { id: v.videoId } });
      if (video.reviewStatus === "CONFIRMED") continue;
      await tx.videoLesson.update({ where: { id: v.videoId }, data: { reviewStatus: "CONFIRMED" } });
      await reconcileVideoPrimary(tx, v.topicId, v.primaryCandidate ? v.videoId : undefined);
    }
    for (const topicId of topicIds) await reconcileVideoPrimary(tx, topicId);
  });

  return { verifiedCount: toVerify.length, confirmedCount: toConfirm.length };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const manifest = loadManifestV2();
  const levels = loadStage6cLevels();

  const backupDir = path.join(
    "D:/НМТ Сайт/backups",
    `stage6f-before-autonomous-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  const backupPath = path.join(backupDir, "dev.db").replaceAll("\\", "/");
  backupDb(WORKING_DB, backupPath);
  const backupSha = await sha256File(backupPath);
  const backupVerify = verifyBackupFile(backupPath);

  const working = prismaFor(WORKING_DB);
  await initializeSQLite(working);
  const fpBefore = await protectedFingerprints(working);
  const questions = await loadQuestions(working);
  if (questions.length !== 84) throw new Error(`Expected 84 questions, got ${questions.length}`);

  const questionReviews = questions.map((q) => reviewQuestionRow(q, manifest));
  const videos = await working.videoLesson.findMany({
    where: { topicId: { in: topicIds } },
    select: { id: true, topicId: true, youtubeId: true, reviewStatus: true, isPrimary: true },
  });
  const videoReviews = reviewVideos(videos, levels);

  const qaPath = path.join(backupDir, "qa-apply.db").replaceAll("\\", "/");
  backupDb(backupPath, qaPath);
  const qa = prismaFor(qaPath);
  await initializeSQLite(qa);
  const qaFpBefore = await protectedFingerprints(qa);
  await applyPlan(qa, questionReviews, videoReviews);
  const qaFpAfter = await protectedFingerprints(qa);

  const protectedOk = Object.keys(qaFpBefore).every(
    (k) => qaFpBefore[k].hash === qaFpAfter[k].hash && qaFpBefore[k].count === qaFpAfter[k].count,
  );

  let applyResult = { verifiedCount: 0, confirmedCount: 0 };
  if (apply) {
    if (!protectedOk) throw new Error("QA protected tables changed — abort working apply");
    applyResult = await applyPlan(working, questionReviews, videoReviews);
  }

  const fpAfter = apply ? await protectedFingerprints(working) : fpBefore;
  const perTopic = [];
  for (const topicId of topicIds) {
    const topic = await working.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { questions: true, videos: true },
    });
    perTopic.push({
      topicId,
      coverage: topic.coverage,
      verified: topic.questions.filter((q) => q.verificationStatus === "VERIFIED").length,
      draft: topic.questions.filter((q) => q.verificationStatus === "DRAFT").length,
      readiness: lessonReadiness(topic),
      primaryVideo: topic.videos.find((v) => v.isPrimary)?.youtubeId ?? null,
      confirmedVideos: topic.videos.filter((v) => v.reviewStatus === "CONFIRMED").map((v) => v.youtubeId),
    });
  }

  const report = {
    status: apply ? (protectedOk ? "PARTIAL" : "BLOCKED") : "PARTIAL",
    applyExecuted: apply,
    backup: { path: backupDir, sha256: backupSha, integrity: backupVerify.integrity, fkCount: backupVerify.fkCount },
    questionStats: {
      reviewed: questionReviews.length,
      verifiedCandidates: questionReviews.filter((r) => r.result === "VERIFIED_CANDIDATE").length,
      unverifiable: questionReviews.filter((r) => r.result === "UNVERIFIABLE").length,
      fixRequired: questionReviews.filter((r) => r.result === "FIX_REQUIRED").length,
      appliedVerified: applyResult.verifiedCount,
    },
    videoStats: {
      reviewed: videoReviews.length,
      confirmedCandidates: videoReviews.filter((v) => v.result === "CONFIRMED_CANDIDATE").length,
      suggestedOnly: videoReviews.filter((v) => v.result === "SUGGESTED_ONLY").length,
      appliedConfirmed: applyResult.confirmedCount,
    },
    questionReviews,
    videoReviews,
    perTopic,
    qa: { protectedOk },
    userDataUnchanged: apply
      ? Object.keys(fpBefore).every((k) => fpBefore[k].hash === fpAfter[k].hash)
      : true,
    policyNote:
      "Videos not CONFIRMED: Stage 6C + owner rules require full content and Ukrainian audio; not achievable in this session. Questions VERIFIED only for 6B.2 corrections + biology q08 with manifest sources; remaining 78 UNVERIFIABLE without per-item dictionary review.",
  };

  writeFileSync(path.join(backupDir, "stage6f-autonomous-report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        backupDir,
        apply,
        ...report.questionStats,
        ...report.videoStats,
        policyNote: report.policyNote,
      },
      null,
      2,
    ),
  );

  await working.$disconnect();
  await qa.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
