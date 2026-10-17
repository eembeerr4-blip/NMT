import { dateKey, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/session";
import { getPrioritiesForUser } from "@/features/personal-plan/data";
import { computeStreak, weekCompletion } from "@/lib/scoring";

export async function addXp(userId: string, amount: number, reason: string) {
  await prisma.xpEvent.create({ data: { userId, amount, reason } });
}

export async function refreshAchievements(userId: string) {
  const [sessionCount, attemptCount, mastered, events, tasks] = await Promise.all([
    prisma.studySession.count({ where: { userId, durationMin: { gt: 0 } } }),
    prisma.testAttempt.count({ where: { userId, status: "COMPLETED" } }),
    prisma.userTopicProgress.count({ where: { userId, status: "MASTERED" } }),
    prisma.studySession.findMany({ where: { userId, durationMin: { gt: 0 } }, select: { startedAt: true } }),
    prisma.studyTask.findMany({ where: { userId } }),
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
  const definitions: Record<string, { title: string; description: string; xp: number }> = {
    "first-session": { title: "Перше заняття", description: "Завершено перше навчальне заняття.", xp: 10 },
    "first-test": { title: "Перший тест", description: "Завершено першу тестову спробу.", xp: 15 },
    "streak-3": { title: "Три дні навчання", description: "Навчання триває щонайменше три дні поспіль.", xp: 20 },
    "streak-7": { title: "Тиждень навчання", description: "Навчання триває щонайменше сім днів поспіль.", xp: 50 },
    "topics-5": { title: "П’ять опанованих тем", description: "П’ять тем позначено опанованими у цьому профілі.", xp: 25 },
    "week-goal": { title: "Тижневий план", description: "Виконано заплановані заняття цього тижня.", xp: 20 },
  };
  for (const code of unlocks) {
    const definition = definitions[code];
    const id = `${userId}:${code}`;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.achievement.findUnique({ where: { id } });
      if (existing) return;
      await tx.achievement.create({
        data: { id, userId, title: definition.title, description: definition.description, xp: definition.xp, unlockedAt: new Date() },
      });
      await tx.xpEvent.create({ data: { userId, amount: definition.xp, reason: definition.title } });
    });
  }
}

export async function subjectPriorities() {
  const user = await getSessionUser();
  if (!user) throw new Error("Потрібен вхід до профілю.");
  const active = await prisma.userSubject.findMany({
    where: { userId: user.id, active: true },
    select: { subjectId: true, targetScore: true },
    orderBy: { subjectId: "asc" },
  });
  const priorities = await getPrioritiesForUser(user.id, active);
  return {
    ...Object.fromEntries(priorities.map((item) => [item.subjectId, item.percent])),
    ids: active.map((item) => item.subjectId),
  };
}
