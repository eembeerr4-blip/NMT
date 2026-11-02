/**
 * Stage 6F.3 — apply subject review decisions to working DB.
 * npx --prefix "D:/НМТ Сайт/NMT-academy" tsx scripts/stage6f3-apply-review.ts [--dry-run]
 */
import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { prepareQuestion } from "../src/lib/question-input";
import { lessonReadiness } from "../src/lib/readiness";
import { initializeSQLite } from "../src/lib/sqlite-init";

const WORKING_DB = "D:/НМТ Сайт/NMT-academy/prisma/dev.db".replaceAll("\\", "/");
const DECISIONS = "D:/НМТ Сайт/backups/stage6f3-review-decisions.json";

const topicIds = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

const PROTECTED = [
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

type Decision = {
  questionId: string;
  outcome: string;
  rationale: string;
  fixes?: { prompt?: string; explanation?: string } | null;
};

function sha256File(p: string) {
  const h = createHash("sha256");
  return new Promise<string>((res, rej) => {
    createReadStream(p)
      .on("data", (c) => h.update(c))
      .on("end", () => res(h.digest("hex")))
      .on("error", rej);
  });
}

function backupDb(src: string, dst: string) {
  mkdirSync(path.dirname(dst), { recursive: true });
  const before = statSync(src);
  const db = new DatabaseSync(src, { readOnly: true });
  try {
    db.prepare(`VACUUM INTO '${dst.replace(/'/g, "''")}'`).run();
  } finally {
    db.close();
  }
  const after = statSync(src);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error("DB changed during backup");
}

async function fp(prisma: PrismaClient, name: string) {
  const c = Number((await prisma.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*) c FROM "${name}"`))[0].c);
  if (!c) return { count: 0, hash: "empty" };
  const rows = await prisma.$queryRawUnsafe<{ blob: string | null }[]>(
    `SELECT group_concat(rowid||':'||quote(rowid),'|') blob FROM "${name}" ORDER BY rowid`,
  );
  return { count: c, hash: createHash("sha256").update(rows[0]?.blob ?? "").digest("hex") };
}

async function allFp(prisma: PrismaClient) {
  const o: Record<string, { count: number; hash: string }> = {};
  for (const n of PROTECTED) o[n] = await fp(prisma, n);
  return o;
}

function prismaFor(db: string) {
  return new PrismaClient({ datasources: { db: { url: `file:${db}?connection_limit=1` } } });
}

async function applyToDb(prisma: PrismaClient, decisions: Decision[], dryRun: boolean) {
  const toVerify = decisions.filter((d) => d.outcome === "VERIFIED_CANDIDATE").map((d) => d.questionId);
  const fix = decisions.find((d) => d.questionId === "ukr-lex-02-q07");

  const run = async (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => {
    if (fix) {
      const q = await tx.question.findUniqueOrThrow({
        where: { id: "ukr-lex-02-q07" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      });
      const newPrompt =
        "Омографами (слова з однаковим написанням і різним наголосом) є слова в парі:";
      const newExplanation =
        "Омографи мають однакове написання, але різний наголос і значення (за́мок — фортеця, замо́к — дверний пристрій). У рядку Б «гриб» і «грип» — різні слова (омофони), не омографи. У рядку В — пароніми. У рядку Г — антоніми, не омографи.";
      const options = q.options.map((o) =>
        o.label === "Г"
          ? { ...o, text: "любов — ненависть" }
          : o,
      );
      const raw = {
        id: q.id,
        subjectId: q.subjectId,
        topicId: q.topicId,
        subtopic: q.subtopic ?? "",
        type: q.type,
        difficulty: q.difficulty,
        prompt: newPrompt,
        explanation: newExplanation,
        correctAnswer: q.correctAnswer,
        source: q.source ?? "",
        verificationStatus: "DRAFT",
        options: options.map((o) => ({
          id: o.id,
          label: o.label,
          text: o.text,
          matchKey: o.matchKey,
        })),
      };
      const parsed = prepareQuestion(raw, { preserveIds: true });
      const { options: opts, id, ...data } = parsed;
      await tx.question.update({ where: { id: id! }, data: { ...data, verificationStatus: "DRAFT" } });
      await tx.questionOption.deleteMany({ where: { questionId: id! } });
      await tx.questionOption.createMany({
        data: opts.map((o, i) => ({ ...o, questionId: id!, sortOrder: i })),
      });
      const fixed = await tx.question.findUniqueOrThrow({
        where: { id: "ukr-lex-02-q07" },
        include: { options: true },
      });
      prepareQuestion(
        {
          id: fixed.id,
          subjectId: fixed.subjectId,
          topicId: fixed.topicId,
          subtopic: fixed.subtopic ?? "",
          type: fixed.type,
          difficulty: fixed.difficulty,
          prompt: fixed.prompt,
          explanation: fixed.explanation,
          correctAnswer: fixed.correctAnswer,
          source: fixed.source ?? "",
          verificationStatus: "DRAFT",
          options: fixed.options.map((o) => ({
            id: o.id,
            label: o.label,
            text: o.text,
            matchKey: o.matchKey,
          })),
        },
        { preserveIds: true },
      );
      await tx.question.update({ where: { id: "ukr-lex-02-q07" }, data: { verificationStatus: "VERIFIED" } });
    }

    for (const id of toVerify) {
      const question = await tx.question.findUniqueOrThrow({
        where: { id },
        include: { options: true },
      });
      if (question.verificationStatus === "VERIFIED") continue;
      if (question.verificationStatus !== "DRAFT") throw new Error(`Unexpected status ${id}`);
      const { verificationStatus: _vs, issueReport: _ir, createdAt: _ca, updatedAt: _ua, ...forPrep } =
        question as typeof question & Record<string, unknown>;
      prepareQuestion(
        {
          ...forPrep,
          subtopic: question.subtopic ?? "",
          source: question.source ?? "",
          verificationStatus: question.verificationStatus,
          options: question.options.map((o) => ({
            id: o.id,
            label: o.label,
            text: o.text,
            matchKey: o.matchKey,
          })),
        },
        { preserveIds: true },
      );
      await tx.question.update({ where: { id }, data: { verificationStatus: "VERIFIED" } });
    }
  };

  if (dryRun) await prisma.$transaction(run);
  else await prisma.$transaction(run);

  return { verified: toVerify.length + (fix ? 1 : 0), fixed: fix ? 1 : 0 };
}

async function main() {
  const dryRunOnly = process.argv.includes("--dry-run");
  const payload = JSON.parse(readFileSync(DECISIONS, "utf8")) as { decisions: Decision[] };
  const decisions = payload.decisions;

  const backupDir = path.join(
    "D:/НМТ Сайт/backups",
    `stage6f3-before-apply-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  const backupPath = path.join(backupDir, "dev.db").replaceAll("\\", "/");
  backupDb(WORKING_DB, backupPath);
  const backupSha = await sha256File(backupPath);
  const bdb = new DatabaseSync(backupPath, { readOnly: true });
  const integrity = (bdb.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
  const fk = bdb.prepare("PRAGMA foreign_key_check").all().length;
  bdb.close();

  const qaPath = path.join(backupDir, "qa.db").replaceAll("\\", "/");
  backupDb(backupPath, qaPath);

  const qa = prismaFor(qaPath);
  await initializeSQLite(qa);
  const fpBefore = await allFp(qa);
  await applyToDb(qa, decisions, true);
  const fpAfter = await allFp(qa);
  const protectedOk = PROTECTED.every(
    (k) => fpBefore[k].hash === fpAfter[k].hash && fpBefore[k].count === fpAfter[k].count,
  );
  if (!protectedOk) throw new Error("QA protected tables changed");

  let applyStats = { verified: 0, fixed: 0 };
  if (!dryRunOnly) {
    const working = prismaFor(WORKING_DB);
    await initializeSQLite(working);
    const wBefore = await allFp(working);
    applyStats = await applyToDb(working, decisions, false);
    const wAfter = await allFp(working);
    if (!PROTECTED.every((k) => wBefore[k].hash === wAfter[k].hash)) throw new Error("Working protected tables changed");

    const perTopic = [];
    for (const topicId of topicIds) {
      const topic = await working.topic.findUniqueOrThrow({
        where: { id: topicId },
        include: { questions: true, videos: true },
      });
      const v = topic.questions.filter((q) => q.verificationStatus === "VERIFIED");
      const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
      for (const q of v) counts[q.difficulty as keyof typeof counts]++;
      perTopic.push({
        topicId,
        verifiedTotal: v.length,
        draft: topic.questions.filter((q) => q.verificationStatus === "DRAFT").length,
        verifiedCounts: counts,
        practiceThreshold: counts.EASY >= 4 && counts.MEDIUM >= 5 && counts.HARD >= 3,
        readiness: lessonReadiness(topic),
      });
    }

    writeFileSync(
      path.join(backupDir, "stage6f3-apply-report.json"),
      JSON.stringify({ backupSha, applyStats, perTopic, integrity, fk }, null, 2),
    );
    await working.$disconnect();
  }

  await qa.$disconnect();
  console.log(
    JSON.stringify(
      { dryRunOnly, backupDir, backupSha, integrity, fk, protectedOk, applyStats },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
