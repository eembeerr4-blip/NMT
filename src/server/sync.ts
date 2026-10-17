import { DEFAULT_SCHEDULE, type ScheduleConfig } from "@/lib/constants";
import { addDateKeys, dateKey, parseDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { buildSlotsForDate, eachDate, windowFor, type TopicPick } from "@/lib/plan";
import { getSessionUser } from "@/server/session";

export async function getSettings(userId?: string) {
  const id = userId ?? (await getSessionUser())?.id;
  const settings = id
    ? await prisma.userSettings.findUnique({ where: { userId: id } })
    : await prisma.userSettings.findUnique({ where: { id: "default" } });
  if (!settings) throw new Error("Базу ще не заповнено. Запустіть npm run db:setup.");
  return {
    ...settings,
    schedule: JSON.parse(settings.scheduleJson) as ScheduleConfig,
    format: JSON.parse(settings.formatJson) as { year: number; officialFormatConfirmed: boolean; note: string; scales: Record<string, Record<string, { raw: number; rating: number }[]>> },
    studyDays: JSON.parse(settings.studyDaysJson) as number[],
  };
}

export async function syncPlan(userId?: string) {
  const settings = await getSettings(userId);
  const ownerId = settings.userId;
  if (!ownerId) return;
  const schedule = settings.schedule.days ? settings.schedule : DEFAULT_SCHEDULE;
  const [topics, progress] = await Promise.all([
    prisma.topic.findMany({ select: { id: true, subjectId: true, title: true, status: true, sortOrder: true, parentId: true } }),
    prisma.userTopicProgress.findMany({ where: { userId: ownerId } }),
  ]);
  const progressStatus = new Map(progress.map((item) => [item.topicId, item.status]));
  const picks: TopicPick[] = topics.map((topic) => ({ ...topic, parentId: topic.parentId, status: progressStatus.get(topic.id) ?? "NOT_STARTED" }));
  const { from, to } = windowFor(dateKey(), settings.planStart);
  const existing = await prisma.studyTask.findMany({
    where: { userId: ownerId, dateKey: { gte: from, lte: to }, templateKey: { not: null } },
  });
  const byKey = new Map(existing.map((task) => [`${task.dateKey}:${task.templateKey}`, task]));
  const create: {
    dateKey: string;
    templateKey: string;
    subjectId: string | null;
    topicId: string | null;
    title: string;
    detail: string;
    kind: string;
    durationMin: number;
    optional: boolean;
    sortOrder: number;
    status: string;
    userId: string;
  }[] = [];
  for (const day of eachDate(from, to)) {
    if (!settings.studyDays.includes(parseDateKey(day).getDay())) continue;
    for (const slot of buildSlotsForDate(day, schedule, picks, settings.planStart)) {
      const current = byKey.get(`${slot.dateKey}:${slot.templateKey}`);
      if (!current) {
        create.push({
          dateKey: slot.dateKey,
          templateKey: slot.templateKey,
          subjectId: slot.subjectId ?? null,
          topicId: slot.topicId ?? null,
          title: slot.title,
          detail: slot.detail,
          kind: slot.kind,
          durationMin: slot.durationMin,
          optional: slot.optional,
          sortOrder: slot.sortOrder,
          status: "PLANNED",
          userId: ownerId,
        });
        continue;
      }
      if (current.status !== "PLANNED") continue;
      const same = current.subjectId === (slot.subjectId ?? null) && current.topicId === (slot.topicId ?? null) && current.title === slot.title && current.detail === slot.detail && current.durationMin === slot.durationMin;
      if (!same) {
        await prisma.studyTask.update({
          where: { id: current.id },
          data: {
            subjectId: slot.subjectId,
            topicId: slot.topicId,
            title: slot.title,
            detail: slot.detail,
            kind: slot.kind,
            durationMin: slot.durationMin,
            optional: slot.optional,
          },
        });
      }
    }
  }
  if (create.length) await prisma.studyTask.createMany({ data: create });
  await shiftOverdue(ownerId, settings.dailyMinutes);
}

async function shiftOverdue(userId: string, cap: number) {
  const today = dateKey();
  const overdue = await prisma.studyTask.findMany({
    where: { userId, status: "PLANNED", dateKey: { lt: today }, optional: false, kind: { notIn: ["rest"] } },
    orderBy: [{ dateKey: "asc" }, { sortOrder: "asc" }],
  });
  for (const task of overdue) {
    let cursor = today;
    for (let step = 0; step < 21; step += 1) {
      const dayTasks = await prisma.studyTask.findMany({ where: { userId, dateKey: cursor, status: { in: ["PLANNED", "IN_PROGRESS"] } } });
      const used = dayTasks.reduce((sum, item) => sum + item.durationMin, 0);
      if (used + task.durationMin <= Math.max(cap, task.durationMin)) {
        await prisma.studyTask.update({
          where: { id: task.id },
          data: { dateKey: cursor, movedFromId: task.movedFromId ?? task.id, notes: task.notes || "Автоматично перенесено на вільний день" },
        }).catch(() => undefined);
        break;
      }
      cursor = addDateKeys(cursor, 1);
    }
  }
}
