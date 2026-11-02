import type { Prisma } from "@prisma/client";
import { UserError } from "@/lib/errors";

// Test.kind is already a persisted string. Draft and archived control sets keep
// their questions reserved too; publication is not a release of a holdout bank.
export const CONTROL_KINDS = ["FINAL", "DELAYED"];
export const ASSESSMENT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const trainingQuestionWhere = {
  testQuestions: { none: { test: { kind: { in: CONTROL_KINDS } } } },
} satisfies Prisma.QuestionWhereInput;

export function isControl(kind: string) {
  return CONTROL_KINDS.includes(kind);
}

// Every reservation and learner launch takes SQLite's write lock BEFORE reading
// the bank/history. This also serializes launches through different test sets.
export async function lockAssessment(db: Prisma.TransactionClient, userId: string) {
  await db.$executeRaw`UPDATE "User" SET "id"="id" WHERE "id"=${userId}`;
}

export async function assertQuestionRoles(db: Prisma.TransactionClient, ids: string[], kind: string, testId?: string) {
  const collision = await db.testQuestion.findFirst({ where: {
    questionId: { in: ids },
    ...(testId ? { testId: { not: testId } } : {}),
    test: { kind: isControl(kind) ? { not: kind } : { in: CONTROL_KINDS } },
  } });
  if (collision) throw new UserError("Навчальні, підсумкові та відкладені набори мають містити різні запитання.");
  if (isControl(kind) && await db.testAttempt.findFirst({ where: {
    test: { questions: { some: { questionId: { in: ids } } } },
  } })) throw new UserError("Ці контрольні запитання вже були відкриті. Потрібен новий незалежний банк.");
}

async function successfulControls(db: Prisma.TransactionClient, userId: string, topicId: string) {
  const attempts = await db.testAttempt.findMany({ where: {
    userId, status: "COMPLETED", pendingCount: 0,
    test: { topicId, kind: { in: CONTROL_KINDS } },
  }, include: { answers: true, test: { include: { questions: { include: { question: true } } } } } });
  return attempts.filter(a => {
    const ids = a.test.questions.map(q => q.questionId);
    return a.finishedAt && a.totalCount !== null && a.totalCount > 0 &&
      a.totalCount === ids.length && new Set(ids).size === ids.length &&
      a.test.questions.every(q => q.question.topicId === topicId) &&
      a.answers.length === a.totalCount && a.answers.every(answer => !answer.needsManualReview && ids.includes(answer.questionId)) &&
      a.correctCount === a.answers.filter(answer => answer.isCorrect === true).length &&
      a.correctCount >= Math.ceil(0.8 * a.totalCount);
  });
}

export async function assertControlStart(db: Prisma.TransactionClient, userId: string,
  set: { kind: string; topicId: string | null; questions: { questionId: string; question: { topicId: string | null } }[] }, now = new Date()) {
  const ids = set.questions.map(q => q.questionId);
  if (!isControl(set.kind)) {
    if (await db.question.count({ where: { id: { in: ids }, ...trainingQuestionWhere } }) !== ids.length)
      throw new UserError("Контрольні запитання недоступні у звичайній практиці.");
    return;
  }
  if (!set.topicId || !ids.length || set.questions.some(q => q.question.topicId !== set.topicId))
    throw new UserError("Контрольний набір має стосуватися однієї теми.");
  if (await db.testAttempt.findFirst({ where: { userId, test: { topicId: set.topicId, kind: set.kind } } }))
    throw new UserError("Цю незалежну перевірку вже розпочато. Продовжіть збережену спробу; повторний запуск заборонений.");
  if (await db.testAttempt.findFirst({ where: { userId, test: { questions: { some: { questionId: { in: ids } } } } } }))
    throw new UserError("Запитання вже відкривалися у вашій попередній спробі.");
  if (set.kind === "DELAYED") {
    const finals = await successfulControls(db, userId, set.topicId);
    if (!finals.some(a => a.test.kind === "FINAL" && a.finishedAt!.getTime() <= now.getTime() - ASSESSMENT_INTERVAL_MS &&
      a.test.questions.every(q => !ids.includes(q.questionId))))
      throw new UserError("Відкладена перевірка доступна через 7 повних діб після успішної підсумкової (не менше 80%, без неперевірених відповідей).");
  }
}

export async function hasIndependentMastery(db: Prisma.TransactionClient, userId: string, topicId: string) {
  const attempts = await successfulControls(db, userId, topicId);
  for (const first of attempts.filter(a => a.test.kind === "FINAL")) {
    for (const delayed of attempts.filter(a => a.test.kind === "DELAYED")) {
      const ids = [...first.test.questions, ...delayed.test.questions].map(q => q.questionId);
      if (first.id === delayed.id || new Set(ids).size !== ids.length ||
        delayed.startedAt.getTime() - first.finishedAt!.getTime() < ASSESSMENT_INTERVAL_MS ||
        delayed.finishedAt!.getTime() < delayed.startedAt.getTime()) continue;
      // Older attempts created before the guards cannot become mastery evidence
      // if their control questions were also exposed as ordinary practice.
      if (!await db.testAttempt.findFirst({ where: { userId, id: { notIn: [first.id, delayed.id] },
        test: { questions: { some: { questionId: { in: ids } } } },
      } })) return true;
    }
  }
  return false;
}
