import type { Prisma } from "@prisma/client";
import { isAutoPlanned } from "@/lib/task-origin";
import { cache } from "react";
import { fitDailyLoad } from "@/lib/fit-daily-load";
import { DEFAULT_SCHEDULE, type ScheduleConfig } from "@/lib/constants";
import { addDateKeys, dateKey, parseDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { buildSlotsForDate, eachDate, windowFor, type TopicPick } from "@/lib/plan";
import { getSessionUser } from "@/server/session";

export async function getSettings(userId?: string, db: Prisma.TransactionClient = prisma) {
  const id = userId ?? (await getSessionUser())?.id;
  const settings = id
    ? await db.userSettings.findUnique({ where: { userId: id } })
    : await db.userSettings.findUnique({ where: { id: "default" } });
  if (!settings) throw new Error("Базу ще не заповнено. Запустіть npm run db:setup.");
  return {
    ...settings,
    schedule: JSON.parse(settings.scheduleJson) as ScheduleConfig,
    format: JSON.parse(settings.formatJson) as { year: number; officialFormatConfirmed: boolean; note: string; scales: Record<string, Record<string, { raw: number; rating: number }[]>> },
    studyDays: JSON.parse(settings.studyDaysJson) as number[],
  };
}

export const syncPlan = cache(async (userId?: string) => syncPlanWithClient(userId));

export async function syncPlanWithClient(userId?: string, db: Prisma.TransactionClient = prisma) {
  const settings = await getSettings(userId, db);
  const ownerId = settings.userId;
  if (!ownerId) return;
  const schedule = settings.schedule.days ? settings.schedule : DEFAULT_SCHEDULE;
  const [topics, progress] = await Promise.all([
    db.topic.findMany({ select: { id: true, subjectId: true, title: true, status: true, sortOrder: true, parentId: true } }),
    db.userTopicProgress.findMany({ where: { userId: ownerId } }),
  ]);
  const progressStatus = new Map(progress.map((item) => [item.topicId, item.status]));
  const picks: TopicPick[] = topics.map((topic) => ({ ...topic, parentId: topic.parentId, status: progressStatus.get(topic.id) ?? "NOT_STARTED" }));
  const { from, to } = windowFor(dateKey(), settings.planStart);
  const existing = await db.studyTask.findMany({
    where: { userId: ownerId, dateKey: { gte: from, lte: to } },
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
    const dayTasks=existing.filter(t=>t.dateKey===day);
    const fixed=dayTasks.filter(t=>(!isAutoPlanned(t) || t.status==="DONE" || t.status==="IN_PROGRESS") && !["MOVED","SKIPPED","DROPPED"].includes(t.status)).reduce((sum,t)=>sum+t.durationMin,0);
    const slots=settings.studyDays.includes(parseDateKey(day).getDay()) ? fitDailyLoad(buildSlotsForDate(day, schedule, picks, settings.planStart).filter(slot=>!dayTasks.some(t=>t.templateKey===slot.templateKey && ["DONE","IN_PROGRESS","MOVED","SKIPPED"].includes(t.status))), Math.max(0,settings.dailyMinutes-fixed)).filter(slot=>slot.durationMin>0 || slot.kind==="rest") : [];
    for(const task of dayTasks.filter(t=>isAutoPlanned(t) && t.status==="PLANNED" && !slots.some(slot=>slot.templateKey===t.templateKey))){
      await db.studyTask.update({where:{id:task.id},data:{status:"DROPPED",notes:"Автоплан: змінено навчальні дні або денний ліміт."}});
    }
    for (const slot of slots) {
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
      if (current.status === "DROPPED" && current.notes.startsWith("Автоплан:")) { await db.studyTask.update({where:{id:current.id},data:{status:"PLANNED",notes:""}}); current.status="PLANNED"; }
      if (current.status !== "PLANNED") continue;
      const same = current.subjectId === (slot.subjectId ?? null) && current.topicId === (slot.topicId ?? null) && current.title === slot.title && current.detail === slot.detail && current.durationMin === slot.durationMin;
      if (!same) {
        await db.studyTask.update({
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
  for (const task of create) {
    await db.studyTask.upsert({ where: { userId_dateKey_templateKey: { userId: task.userId, dateKey: task.dateKey, templateKey: task.templateKey } }, update: {}, create: task });
  }
  await shiftOverdue(ownerId, settings.dailyMinutes, settings.studyDays, db);
}

async function shiftOverdue(userId: string, cap: number, studyDays: number[], db: Prisma.TransactionClient) {
  const today = dateKey();
  const overdue = await db.studyTask.findMany({
    where: { userId, status: "PLANNED", dateKey: { lt: today }, optional: false, kind: { notIn: ["rest"] } },
    orderBy: [{ dateKey: "asc" }, { sortOrder: "asc" }],
  });
  for (const task of overdue) {
    if (task.durationMin > cap) {
      await db.studyTask.update({ where: { id: task.id }, data: { notes: "Заняття довше за денний ліміт. Розділіть його або змініть навантаження." } });
      continue;
    }
    let cursor = today;
    for (let step = 0; step < 21; step += 1) {
      if (!studyDays.includes(parseDateKey(cursor).getDay())) { cursor = addDateKeys(cursor, 1); continue; }
      const dayTasks = await db.studyTask.findMany({ where: { userId, dateKey: cursor, status: { in: ["PLANNED", "IN_PROGRESS"] } } });
      const used = dayTasks.reduce((sum, item) => sum + item.durationMin, 0);
      if (used + task.durationMin <= cap) {
        await db.studyTask.update({
          where: { id: task.id },
          data: { dateKey: cursor, movedFromId: task.movedFromId ?? task.id, notes: task.notes || "Автоматично перенесено на вільний день" },
        }).catch(() => undefined);
        break;
      }
      cursor = addDateKeys(cursor, 1);
    }
  }
}

export async function rebuildFuturePlan(userId: string, db: Prisma.TransactionClient = prisma) {
  const planned = await db.studyTask.findMany({where:{userId,status:"PLANNED",dateKey:{gte:dateKey()}}});
  const ids = planned.filter(isAutoPlanned).map(task=>task.id);
  if(ids.length) await db.studyTask.deleteMany({where:{userId,id:{in:ids}}});
  await syncPlanWithClient(userId, db);
}
