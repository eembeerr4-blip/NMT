import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { prepareQuestion } from "../src/lib/question-input";
import { lessonReadiness } from "../src/lib/readiness";

type Manifest = {
  updates: { id: string; match: { promptContains?: string; promptSha256Prefix?: string }; question: unknown }[];
  additions: unknown[];
};

async function persistLikeSave(tx: import("@prisma/client").Prisma.TransactionClient, raw: unknown) {
  const q = prepareQuestion(raw, { preserveIds: Boolean((raw as { id?: string }).id) });
  const topic = await tx.topic.findUnique({ where: { id: q.topicId } });
  if (!topic || topic.subjectId !== q.subjectId) throw new Error("Topic/subject mismatch");
  const { options, id, ...data } = q;
  const saved = await tx.question.upsert({
    where: { id: id! },
    update: { ...data, verificationStatus: "DRAFT" },
    create: { ...data, id: id!, verificationStatus: "DRAFT" },
  });
  await tx.questionOption.deleteMany({ where: { questionId: saved.id } });
  if (options.length) {
    await tx.questionOption.createMany({
      data: options.map((o) => ({ ...o, questionId: saved.id })),
    });
  }
}

async function main() {
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "content/stage6b/stage6b-question-bank-manifest.v1.json"), "utf8"),
  ) as Manifest;

  const prisma = new PrismaClient();
  const before = await snapshot(prisma);

  await prisma.$transaction(async (tx) => {
    for (const u of manifest.updates) {
      const existing = await tx.question.findUnique({ where: { id: u.id } });
      if (!existing) throw new Error(`Missing ${u.id}`);
      if (u.match.promptContains && !existing.prompt.includes(u.match.promptContains)) {
        throw new Error(`Match failed for ${u.id}: prompt changed`);
      }
      await persistLikeSave(tx, u.question);
    }
    for (const a of manifest.additions) {
      const id = (a as { id: string }).id;
      if (await tx.question.findUnique({ where: { id } })) throw new Error(`Addition id exists ${id}`);
      await persistLikeSave(tx, a);
    }
  });

  const after = await snapshot(prisma);
  const qa = await runQa(prisma);
  writeFileSync(
    path.join(process.cwd(), "content/stage6b/stage6b-qa-after-apply.json"),
    JSON.stringify({ before, after, qa }, null, 2),
  );
  console.log(JSON.stringify(qa, null, 2));
  await prisma.$disconnect();
}

async function snapshot(prisma: PrismaClient) {
  return {
    answer: await prisma.answer.count(),
    testAttempt: await prisma.testAttempt.count(),
    mistake: await prisma.mistake.count(),
    reviewSchedule: await prisma.reviewSchedule.count(),
    question: await prisma.question.count(),
    draftTopics: await prisma.topic.count({ where: { coverage: "DRAFT" } }),
  };
}

async function runQa(prisma: PrismaClient) {
  const topicIds = [
    "ukr-lex-01-meaning",
    "ukr-lex-02-syn-ant-hom",
    "ukr-lex-03-phraseology",
    "bio-cell-01-eukaryotic-cell",
    "zcode-biology-molecular-dna-rna",
    "zcode-biology-molecular-protein-synth",
    "zcode-biology-molecular-division",
  ];
  const perTopic = [];
  let prepareErrors: string[] = [];
  const prompts = new Set<string>();

  for (const topicId of topicIds) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { questions: { include: { options: true } } },
    });
    if (!topic) throw new Error("missing topic");
    const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of topic.questions) {
      counts[q.difficulty as keyof typeof counts]++;
      const key = q.prompt.trim().toLowerCase();
      if (prompts.has(key)) prepareErrors.push(`duplicate prompt ${q.id}`);
      prompts.add(key);
      try {
        prepareQuestion(
          {
            ...q,
            options: q.options.map((o) => ({
              id: o.id,
              label: o.label,
              text: o.text,
              matchKey: o.matchKey ?? undefined,
            })),
          },
          { preserveIds: true },
        );
      } catch (e) {
        prepareErrors.push(`${q.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const readiness = lessonReadiness({
      lessonJson: topic.lessonJson,
      questions: topic.questions,
      videos: [],
    });
    perTopic.push({
      topicId,
      total: topic.questions.length,
      counts,
      practiceThreshold: readiness.practice,
      readyIfVerified: readiness.ready,
    });
  }

  return {
    perTopic,
    allTopicsMin12: perTopic.every((t) => t.total >= 12),
    allPracticeThresholds: perTopic.every((t) => t.practiceThreshold),
    prepareErrors,
    coverageStillDraft: (await prisma.topic.findMany({ where: { id: { in: topicIds } }, select: { coverage: true } })).every(
      (t) => t.coverage === "DRAFT",
    ),
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
