import { SUBJECT_IDS } from "@/lib/constants";
import { dateKey, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { computeStreak, weekCompletion } from "@/lib/scoring";

export async function addXp(amount: number, reason: string) {
  await prisma.xpEvent.create({ data: { amount, reason } });
}

export async function refreshAchievements() {
  const [sessionCount, attemptCount, mastered, events, tasks] = await Promise.all([
    prisma.studySession.count({ where: { durationMin: { gt: 0 } } }),
    prisma.testAttempt.count({ where: { status: "COMPLETED" } }),
    prisma.topic.count({ where: { status: "MASTERED" } }),
    prisma.studySession.findMany({ where: { durationMin: { gt: 0 } }, select: { startedAt: true } }),
    prisma.studyTask.findMany(),
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
  const locked = await prisma.achievement.findMany({ where: { id: { in: unlocks }, unlockedAt: null } });
  for (const achievement of locked) {
    await prisma.achievement.update({ where: { id: achievement.id }, data: { unlockedAt: new Date() } });
    await addXp(achievement.xp, achievement.title);
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
