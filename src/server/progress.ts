import type { Prisma } from "@prisma/client";
import { SUBJECT_IDS } from "@/lib/constants";
import { getSessionUser } from "@/server/session";
import { dateKey, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { computeStreak, weekCompletion } from "@/lib/scoring";

export async function addXp(amount: number, reason: string, db: Prisma.TransactionClient = prisma, userId?: string) {
  const user = userId ? {id:userId} : await getSessionUser();
  if (!user) throw new Error("Потрібен вхід до профілю.");
  await db.xpEvent.create({ data: { amount, reason, userId: user.id } });
}

export async function refreshAchievements(db: Prisma.TransactionClient = prisma, userId?: string) {
  const user = userId ? {id:userId} : await getSessionUser();
  if (!user) return;
  const [sessionCount, attemptCount, mastered, events, tasks] = await Promise.all([
    db.studySession.count({ where: { userId: user.id, durationMin: { gt: 0 } } }),
    db.testAttempt.count({ where: { userId: user.id, status: "COMPLETED" } }),
    db.userTopicProgress.count({ where: { userId: user.id, status: "MASTERED" } }),
    db.studySession.findMany({ where: { userId: user.id, durationMin: { gt: 0 } }, select: { startedAt: true } }),
    db.studyTask.findMany({ where: { userId: user.id } }),
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
  const templates = await db.achievement.findMany({ where: { id: { in: unlocks } } });
  for (const template of templates) {
    const id = user.id === "owner" && template.userId === user.id ? template.id : `${user.id}:${template.id}`;
    const unlock = async (tx: Prisma.TransactionClient) => {
      const current = await tx.achievement.findUnique({ where: { id } });
      if (current?.unlockedAt) return;
      await tx.achievement.upsert({ where: { id }, update: { unlockedAt: new Date(), userId: user.id }, create: { id, title: template.title, description: template.description, xp: template.xp, userId: user.id, unlockedAt: new Date() } });
      await tx.xpEvent.create({ data: { amount: template.xp, reason: template.title, userId: user.id } });
    };
    if (db === prisma) await prisma.$transaction(unlock);
    else await unlock(db);
  }
}

export async function subjectPriorities() {
  const user = await getSessionUser();
  const settings = user ? await prisma.userSettings.findUnique({ where: { userId: user.id } }) : null;
  return {
    math: settings?.mathPriority ?? 35,
    ukrainian: settings?.ukrainianPriority ?? 25,
    history: settings?.historyPriority ?? 20,
    biology: settings?.biologyPriority ?? 20,
    ids: SUBJECT_IDS,
  };
}
