import type { PrismaClient } from "@prisma/client";
import { learnerQuestionAvailable } from "@/lib/test-access";
import { lessonAccess } from "@/lib/readiness";

export const learnerReviewTopicFilter = { coverage: { not: "DRAFT" as const } };

export type MistakeScope = {
  userId: string;
  activeSubjectIds: string[];
  readableQuestionIds: string[];
};

export function mistakeScopeWhere(scope: MistakeScope) {
  return {
    userId: scope.userId,
    questionId: { in: scope.readableQuestionIds },
    ...(scope.activeSubjectIds.length ? { subjectId: { in: scope.activeSubjectIds } } : {}),
  };
}

export async function loadReadableMistakeQuestionIds(prisma: PrismaClient, userId: string) {
  const rows = await prisma.question.findMany({
    where: { mistakes: { some: { userId } } },
    include: { topic: true },
  });
  return rows.filter(learnerQuestionAvailable).map((question) => question.id);
}

export type MistakeStatusOverview = {
  open: number;
  reviewing: number;
  fixed: number;
  topTopics: { topicId: string; title: string; subjectName: string; count: number }[];
};

export async function loadMistakeStatusOverview(prisma: PrismaClient, scope: MistakeScope): Promise<MistakeStatusOverview> {
  const base = mistakeScopeWhere(scope);
  const [open, reviewing, fixed, grouped] = await Promise.all([
    prisma.mistake.count({ where: { ...base, status: "OPEN" } }),
    prisma.mistake.count({ where: { ...base, status: "REVIEWING" } }),
    prisma.mistake.count({ where: { ...base, status: "FIXED" } }),
    prisma.mistake.groupBy({
      by: ["topicId"],
      where: { ...base, status: { in: ["OPEN", "REVIEWING"] }, topicId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const ranked = grouped
    .filter((row) => row.topicId)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 5);
  const topicIds = ranked.map((row) => row.topicId!);
  const topics = topicIds.length
    ? await prisma.topic.findMany({ where: { id: { in: topicIds } }, include: { subject: true } })
    : [];
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const topTopics = ranked.map((row) => {
    const topic = topicMap.get(row.topicId!);
    return {
      topicId: row.topicId!,
      title: topic?.title ?? "Тема",
      subjectName: topic?.subject.name ?? "",
      count: row._count._all,
    };
  });
  return { open, reviewing, fixed, topTopics };
}

export async function loadPendingReviewTopicIds(prisma: PrismaClient, userId: string) {
  const rows = await prisma.reviewSchedule.findMany({
    where: { userId, status: "PENDING", topic: learnerReviewTopicFilter },
    select: { topicId: true },
    distinct: ["topicId"],
  });
  return new Set(rows.map((row) => row.topicId));
}

export async function loadActiveMistakeCountsForTopics(
  prisma: PrismaClient,
  scope: MistakeScope,
  topicIds: string[],
) {
  if (!topicIds.length) return new Map<string, number>();
  const rows = await prisma.mistake.groupBy({
    by: ["topicId"],
    where: {
      ...mistakeScopeWhere(scope),
      topicId: { in: topicIds },
      status: { not: "FIXED" },
    },
    _count: { _all: true },
  });
  return new Map(rows.filter((row) => row.topicId).map((row) => [row.topicId!, row._count._all]));
}

export type ReviewScheduleRow = {
  id: string;
  topicId: string;
  dueKey: string;
  priority: number;
  intervalDays: number;
  topic: {
    title: string;
    lessonJson: string;
    coverage: string;
    subject: { id: string; name: string };
    videos: { reviewStatus: string }[];
  };
};

export type ReviewOverview = {
  overdueCount: number;
  todayCount: number;
  nextDueKey: string | null;
  attentionTopics: { topicId: string; title: string; subjectName: string; reason: string }[];
};

export async function loadReviewOverview(prisma: PrismaClient, userId: string, today: string): Promise<ReviewOverview> {
  const pending = { userId, status: "PENDING" as const, topic: learnerReviewTopicFilter };
  const [overdueCount, todayCount, nextItem, overdueGroups, needsReview] = await Promise.all([
    prisma.reviewSchedule.count({ where: { ...pending, dueKey: { lt: today } } }),
    prisma.reviewSchedule.count({ where: { ...pending, dueKey: today } }),
    prisma.reviewSchedule.findFirst({
      where: { ...pending, dueKey: { gt: today } },
      orderBy: { dueKey: "asc" },
      select: { dueKey: true },
    }),
    prisma.reviewSchedule.groupBy({
      by: ["topicId"],
      where: { ...pending, dueKey: { lt: today } },
      _count: { _all: true },
    }),
    prisma.userTopicProgress.findMany({
      where: { userId, status: "NEEDS_REVIEW", topic: learnerReviewTopicFilter },
      include: { topic: { include: { subject: true } } },
      take: 12,
    }),
  ]);
  const topicIds = [...new Set([...overdueGroups.map((row) => row.topicId), ...needsReview.map((row) => row.topicId)])];
  const topics = topicIds.length
    ? await prisma.topic.findMany({ where: { id: { in: topicIds } }, include: { subject: true } })
    : [];
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const overdueSet = new Set(overdueGroups.map((row) => row.topicId));
  const attention: ReviewOverview["attentionTopics"] = [];
  for (const row of overdueGroups.sort((a, b) => b._count._all - a._count._all).slice(0, 6)) {
    const topic = topicMap.get(row.topicId);
    if (!topic) continue;
    attention.push({
      topicId: row.topicId,
      title: topic.title,
      subjectName: topic.subject.name,
      reason: "Прострочене повторення",
    });
  }
  for (const row of needsReview) {
    if (overdueSet.has(row.topicId) || attention.some((item) => item.topicId === row.topicId)) continue;
    attention.push({
      topicId: row.topicId,
      title: row.topic.title,
      subjectName: row.topic.subject.name,
      reason: "Потрібне закріплення",
    });
    if (attention.length >= 8) break;
  }
  return {
    overdueCount,
    todayCount,
    nextDueKey: nextItem?.dueKey ?? null,
    attentionTopics: attention.slice(0, 8),
  };
}

export function reviewPriorityLabel(priority: number) {
  return priority > 1 ? "Високий пріоритет" : "";
}

export function topicHasLearnerTheory(topic: { lessonJson: string; coverage?: string; videos?: { reviewStatus: string }[] }) {
  return lessonAccess(topic).theory;
}

export function mergeReviewTopicIds(items: { topicId: string }[]) {
  return [...new Set(items.map((item) => item.topicId))];
}
