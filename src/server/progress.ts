import { SUBJECT_IDS } from "@/lib/constants";
import { getSessionUser } from "@/server/session";
import { dateKey, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { computeStreak, weekCompletion } from "@/lib/scoring";

export async function addXp(amount: number, reason: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Потрібен вхід до профілю.");
  await prisma.xpEvent.create({ data: { amount, reason, userId: user.id } });
}

export async function refreshAchievements() {
  const user = await getSessionUser();
  if (!user) return;
  const [sessionCount, attemptCount, mastered, events, tasks] = await Promise.all([
    prisma.studySession.count({ where: { userId: user.id, durationMin: { gt: 0 } } }),
    prisma.testAttempt.count({ where: { userId: user.id, status: "COMPLETED" } }),
    prisma.userTopicProgress.count({ where: { userId: user.id, status: "MASTERED" } }),
    prisma.studySession.findMany({ where: { userId: user.id, durationMin: { gt: 0 } }, select: { startedAt: true } }),
    prisma.studyTask.findMany({ where: { userId: user.id } }),
  ]);
  const active = events.map((event) => dateKey(event.startedAt));
  const streak = computeStreak(active, dateKey());
  const weekStart = dateKey(startOfWeekMonday());
  const weekEndDate = startOfWeekMonday();
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = dateKey(weekEndDate);
  const completion = weekCompletion(tasks.filter((task) => task.dateKey >= weekStart && task.dateKey <= weekEnd));
  const unlocks = [
    sessionCount > 0 ? "first-session" : "",
    attemptCount > 0 ? "first-test" : "",
    streak >= 3 ? "streak-3" : "",
    streak >= 7 ? "streak-7" : "",
    mastered >= 5 ? "topics-5" : "",
    completion >= 100 ? "week-goal" : "",
  ].filter(Boolean);
  if (unlocks.length === 0) return;
  const templates = await prisma.achievement.findMany({ where: { id: { in: unlocks } } });
  for (const template of templates) {
    const id = user.id === "owner" && template.userId === user.id ? template.id : `${user.id}:${template.id}`;
    await prisma.$transaction(async (tx) => {
      const current = await tx.achievement.findUnique({ where: { id } });
      if (current?.unlockedAt) return;
      await tx.achievement.upsert({ where: { id }, update: { unlockedAt: new Date(), userId: user.id }, create: { id, title: template.title, description: template.description, xp: template.xp, userId: user.id, unlockedAt: new Date() } });
      await tx.xpEvent.create({ data: { amount: template.xp, reason: template.title, userId: user.id } });
    });
  }
}

export async function subjectPriorities() {
  const settings = await prisma.userSettings.findUnique({ where: { id: "default" } });
  return {
    math: settings?.mathPriority ?? 35,
    ukrainian: settings?.ukrainianPriority ?? 25,
    history: settings?.historyPriority ?? 20,
    biology: settings?.biologyPriority ?? 20,
    ids: SUBJECT_IDS,
  };
}
