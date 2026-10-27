import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/errors";
import { learnerTestAvailable, unavailableTestMessage } from "@/lib/test-access";

export async function requireAccessibleAttempt(attemptId: string, userId: string, db: Prisma.TransactionClient = prisma) {
  const attempt = await db.testAttempt.findUnique({
    where: { id: attemptId, userId },
    include: { test: { include: { questions: { orderBy: { sortOrder: "asc" }, include: { question: { include: { topic: true } } } } } } },
  });
  if (!attempt || !learnerTestAvailable(attempt.test)) throw new UserError(unavailableTestMessage);
  return attempt;
}
