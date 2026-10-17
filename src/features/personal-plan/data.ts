import { requireUser } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { distributeStudyPriorities } from "./priorities";

export type PersonalStudySubject = {
  id: string;
  name: string;
  role: string;
  targetScore: number | null;
  baseline: {
    id: string;
    subjectId: string;
    date: string;
    title: string;
    ratingScore: number | null;
    rawScore: number | null;
    maxRawScore: number | null;
    partial: boolean;
    belowThreshold: boolean;
    comment: string;
  } | null;
  confirmedErrors: number;
  priorityPercent: number;
};

export async function getPersonalStudySummary() {
  const user = await requireUser();
  const active = await prisma.userSubject.findMany({
    where: { userId: user.id, active: true },
    include: { subject: { select: { id: true, name: true } } },
    orderBy: { subject: { sortOrder: "asc" } },
  });
  const subjectIds = active.map((item) => item.subjectId);
  const [baselines, priorities] = await Promise.all([
    prisma.examResult.findMany({
      where: { userId: user.id, isBaseline: true, subjectId: { in: subjectIds } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    getPrioritiesForUser(user.id, active),
  ]);
  const baselineBySubject = new Map<string, (typeof baselines)[number]>();
  for (const baseline of baselines) {
    if (!baselineBySubject.has(baseline.subjectId)) baselineBySubject.set(baseline.subjectId, baseline);
  }
  const priorityBySubject = new Map(priorities.map((item) => [item.subjectId, item]));
  const subjects: PersonalStudySubject[] = active.map((item) => {
    const baseline = baselineBySubject.get(item.subjectId);
    return {
      id: item.subjectId,
      name: item.subject.name,
      role: item.role,
      targetScore: item.targetScore,
      baseline: baseline ? {
        id: baseline.id,
        subjectId: baseline.subjectId,
        date: baseline.date.toISOString(),
        title: baseline.title,
        ratingScore: baseline.ratingScore,
        rawScore: baseline.rawScore,
        maxRawScore: baseline.maxRawScore,
        partial: baseline.partial,
        belowThreshold: baseline.belowThreshold,
        comment: baseline.comment,
      } : null,
      confirmedErrors: priorityBySubject.get(item.subjectId)?.confirmedErrors ?? 0,
      priorityPercent: priorityBySubject.get(item.subjectId)?.percent ?? 0,
    };
  });
  const resultsRecorded = subjects.filter((subject) => subject.baseline !== null).length;
  const diagnosticStatus = user.diagnosticSkipped
    ? "SKIPPED"
    : resultsRecorded === subjects.length && subjects.length > 0
      ? "COMPLETE"
      : resultsRecorded > 0
        ? "PARTIAL"
        : "NOT_STARTED";

  return {
    userId: user.id,
    activeSubjects: subjects,
    diagnosticStatus,
    onboardingRequired: !user.onboarded,
    onboardingStep: user.onboardingStep,
    planVersion: user.planVersion,
  };
}

export async function getPrioritiesForUser(
  userId: string,
  activeSubjects: Array<{ subjectId: string; targetScore: number | null }>,
) {
  const subjectIds = activeSubjects.map((subject) => subject.subjectId);
  const [baselines, mistakeCounts, answerCounts] = await Promise.all([
    prisma.examResult.findMany({
      where: { userId, isBaseline: true, subjectId: { in: subjectIds } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    Promise.all(subjectIds.map(async (subjectId) => [
      subjectId,
      await prisma.mistake.count({ where: { userId, subjectId, status: { not: "FIXED" } } }),
    ] as const)),
    Promise.all(subjectIds.map(async (subjectId) => [
      subjectId,
      await prisma.answer.count({
        where: {
          isCorrect: false,
          attempt: { userId, status: "COMPLETED" },
          question: { subjectId },
        },
      }),
    ] as const)),
  ]);
  const baselineBySubject = new Map<string, (typeof baselines)[number]>();
  for (const result of baselines) {
    if (!baselineBySubject.has(result.subjectId)) baselineBySubject.set(result.subjectId, result);
  }
  const mistakesBySubject = new Map(mistakeCounts);
  const answersBySubject = new Map(answerCounts);

  return distributeStudyPriorities(activeSubjects.map((subject) => ({
    subjectId: subject.subjectId,
    currentRating: baselineBySubject.get(subject.subjectId)?.ratingScore ?? null,
    targetRating: subject.targetScore,
    confirmedErrors: (mistakesBySubject.get(subject.subjectId) ?? 0) + (answersBySubject.get(subject.subjectId) ?? 0),
  })));
}
