import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertExternalAssignment } from "@/lib/external-practice-integrity";
import { addDateKeys, dateKey, noonUtc, parseDateKey } from "@/lib/dates";
import { externalSubject, nextVariant, practiceSchedule, safeZnoUrl, externalResultSchema, type ExternalResultInput } from "@/lib/external-practice";
import { UserError } from "@/lib/errors";

type DB = Prisma.TransactionClient;
export async function externalPracticeReady(db: DB = prisma) {
  const rows = await db.$queryRaw<{ name: string }[]>`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ExternalPractice','ExternalResultRevision')`;
  return rows.length === 2;
}
// Old databases remain readable until the owner explicitly approves the additive migration.
export async function externalAssignments(userId: string, db: DB = prisma) {
  if (!await externalPracticeReady(db)) return [];
  const rows=await db.externalPractice.findMany({ where: { userId }, include: { task: true, result: true }, orderBy: [{ initialDate: "asc" }, { id: "asc" }] });
  for(const row of rows) assertExternalAssignment(row,row.task,row.result);
  return rows;
}
export async function practiceTransaction<T>(db: DB, work: (tx: DB) => Promise<T>): Promise<T> {
  return "$transaction" in db ? (db as typeof prisma).$transaction(work) : work(db);
}
async function lockUser(db: DB, userId: string) {
  // Acquire SQLite's writer lock before reading the sequence (no deferred read/write upgrade race).
  const count = await db.$executeRaw`UPDATE UserSettings SET id=id WHERE userId=${userId}`;
  if (!count) throw new UserError("Спершу завершіть налаштування навчання.");
}
export async function syncExternalPractice(userId: string, db: DB = prisma, today = dateKey()) {
  if (!await externalPracticeReady(db)) return;
  return practiceTransaction(db, async tx => {
    await lockUser(tx, userId);
    const settings = await tx.userSettings.findUniqueOrThrow({ where: { userId } });
    const schedule = JSON.parse(settings.scheduleJson);
    const config = practiceSchedule(schedule);
    const studyDays: number[] = JSON.parse(settings.studyDaysJson);
    const days = config.enabled ? config.days.filter(d => studyDays.includes(d)) : [];
    const active = await tx.userSubject.findMany({ where: { userId, active: true } });
    const elective = active.find(s => s.role === "ELECTIVE" && ["geography", "biology"].includes(s.subjectId))?.subjectId;
    const subjects = ["math", "ukrainian", "history", ...(elective ? [elective] : [])].filter(id => active.some(s => s.subjectId === id));
    const rows = await externalAssignments(userId, tx);
    const tasks = await tx.studyTask.findMany({ where: { userId, dateKey: { gte: today }, status: { in: ["PLANNED", "IN_PROGRESS", "DONE"] } } });
    const externalIds = new Set(rows.map(r => r.taskId));
    const used = new Map<string, number>();
    for (const task of tasks) if (!externalIds.has(task.id)) used.set(task.dateKey, (used.get(task.dateKey) ?? 0) + task.durationMin);
    const occupied = new Set(rows.filter(r => ["COMPLETED", "SKIPPED"].includes(r.status) || r.task.dateKey < today || r.task.status === "IN_PROGRESS").map(r => r.task.dateKey));
    const ordered = [...subjects].sort((a,b) => {
      const last = (id: string) => rows.filter(r => r.subjectId === id && ["COMPLETED","SKIPPED"].includes(r.status)).at(-1)?.task.dateKey ?? "";
      return last(a).localeCompare(last(b)) || subjects.indexOf(a)-subjects.indexOf(b);
    });
    // Preserve past, explicitly moved, in-progress and completed assignments. Reschedule only future untouched ones.
    const preserved = new Set<string>();
    const pending = rows.filter(r => ["PLANNED", "PAUSED"].includes(r.status));
    for (const row of pending) {
      if ((row.status === "PLANNED" && row.task.dateKey < today) || row.task.status === "IN_PROGRESS" || (row.status === "PLANNED" && row.task.notes.startsWith("Перенесено вручну") && studyDays.includes(parseDateKey(row.task.dateKey).getDay()) && (used.get(row.task.dateKey) ?? 0) + row.task.durationMin <= settings.dailyMinutes)) {
        preserved.add(row.id);
        occupied.add(row.task.dateKey);
        used.set(row.task.dateKey, (used.get(row.task.dateKey) ?? 0) + row.task.durationMin);
      }
    }
    const findDate = () => {
      for (let i=0;i<42;i++) {
        const day=addDateKeys(today,i);
        if (day < settings.planStart || !days.includes(parseDateKey(day).getDay()) || occupied.has(day)) continue;
        if ((used.get(day) ?? 0) + config.durationMin <= settings.dailyMinutes) { occupied.add(day); return day; }
      }
      return null;
    };
    for (const row of pending.filter(r => !subjects.includes(r.subjectId) || !days.length)) {
      if (row.task.status !== "IN_PROGRESS") {
        await tx.studyTask.update({ where: { id: row.taskId, userId }, data: { status: "DROPPED" } });
        await tx.externalPractice.update({ where: { id: row.id }, data: { status: "PAUSED" } });
      }
    }
    for (const subjectId of ordered) {
      const current = pending.find(r => r.subjectId === subjectId);
      if (current && preserved.has(current.id)) continue;
      if (!days.length) continue;
      const day = findDate();
      if (!day) {
        if (current) {
          await tx.studyTask.update({ where: { id: current.taskId, userId }, data: { status: "DROPPED" } });
          await tx.externalPractice.update({ where: { id: current.id }, data: { status: "PAUSED" } });
        }
        continue;
      }
      if (current) {
        if (current.task.dateKey !== day || current.task.durationMin !== config.durationMin || current.status === "PAUSED") {
          await tx.studyTask.update({ where: { id: current.taskId, userId }, data: { dateKey: day, durationMin: config.durationMin, status: "PLANNED", ...(current.task.dateKey!==day?{notes:[current.task.notes,`Розклад змінено: ${current.task.dateKey} → ${day}`].filter(Boolean).join("\n")}: {}) } });
          await tx.externalPractice.update({ where: { id: current.id }, data: { status: "PLANNED" } });
        }
        continue;
      }
      const consumed=rows.filter(r => r.subjectId===subjectId).map(r=>r.variantNumber);
      const variant=nextVariant(subjectId,consumed);
      if (!variant || !externalSubject(subjectId) || !safeZnoUrl(variant.url)) continue;
      const task=await tx.studyTask.create({data:{userId,subjectId,dateKey:day,title:`Тренувальне НМТ · ${variant.title}`,detail:`ZNO Online · ${variant.questionCount} завдань · результат вноситься самостійно`,kind:"mock",durationMin:config.durationMin,templateKey:`zno:${subjectId}:${variant.number}`,sortOrder:0}});
      await tx.externalPractice.create({data:{userId,subjectId,variantNumber:variant.number,title:variant.title,url:variant.url,questionCount:variant.questionCount,initialDate:day,taskId:task.id}});
    }
  });
}

export async function saveExternalResultFor(userId: string, raw: ExternalResultInput, db: DB = prisma) {
  const data=externalResultSchema.parse(raw);
  return practiceTransaction(db, async tx => {
    await lockUser(tx,userId);
    const row=await tx.externalPractice.findFirst({where:{id:data.assignmentId,userId},include:{result:true,task:true}});
    if (!row || row.status === "SKIPPED") throw new UserError("Призначення недоступне.");
    assertExternalAssignment(row,row.task,row.result);
    if (data.errorCount !== null && data.errorCount > row.questionCount) throw new UserError("Кількість помилок перевищує кількість завдань.");
    const snapshot=JSON.stringify({date:data.date,rawScore:data.rawScore,maxRawScore:data.maxRawScore,ratingScore:data.ratingScore,errorCount:data.errorCount,comment:data.comment});
    const last=await tx.externalResultRevision.findFirst({where:{assignmentId:row.id},orderBy:{version:"desc"}});
    if (last?.snapshotJson === snapshot) return row.resultId!;
    if (row.version !== data.version) throw new UserError("Результат уже змінено. Оновіть сторінку перед редагуванням.");
    const payload={userId,subjectId:row.subjectId,date:noonUtc(data.date),testType:"MANUAL",source:"ZNO_ONLINE · SELF_REPORTED",title:`Тренувальне НМТ-2027 · ${row.title}`,rawScore:data.rawScore,maxRawScore:data.maxRawScore,ratingScore:data.ratingScore,errorCount:data.errorCount,comment:data.comment,countsTowardAverage:false};
    const result=row.resultId ? await tx.examResult.update({where:{id:row.resultId,userId},data:payload}) : await tx.examResult.create({data:payload});
    await tx.externalResultRevision.create({data:{assignmentId:row.id,version:row.version+1,snapshotJson:snapshot}});
    await tx.externalPractice.update({where:{id:row.id},data:{status:"COMPLETED",resultId:result.id,version:{increment:1}}});
    await tx.studyTask.update({where:{id:row.taskId,userId},data:{status:"DONE",completedAt:row.task.completedAt ?? new Date()}});
    return result.id;
  });
}
export async function changeExternalTaskFor(userId:string,id:string,operation:"skip"|"move",nextDate?:string,db:DB=prisma) {
  return practiceTransaction(db,async tx=>{
    await lockUser(tx,userId);
    const row=await tx.externalPractice.findFirst({where:{id,userId},include:{task:true,result:true}});
    if (!row || !["PLANNED","PAUSED"].includes(row.status)) throw new UserError("Призначення вже завершене або недоступне.");
    assertExternalAssignment(row,row.task,row.result);
    if(operation === "skip") {
      await tx.externalPractice.update({where:{id},data:{status:"SKIPPED"}});
      await tx.studyTask.update({where:{id:row.taskId,userId},data:{status:"SKIPPED"}});
    } else {
      const settings=await tx.userSettings.findUniqueOrThrow({where:{userId}});
      const days:number[]=JSON.parse(settings.studyDaysJson);
      if(!nextDate || nextDate<dateKey() || !days.includes(parseDateKey(nextDate).getDay())) throw new UserError("Оберіть майбутній навчальний день, не день відпочинку.");
      const tasks=await tx.studyTask.findMany({where:{userId,dateKey:nextDate,id:{not:row.taskId},status:{in:["PLANNED","IN_PROGRESS","DONE"]}}});
      if(tasks.some(t=>t.kind==="mock") || tasks.reduce((s,t)=>s+t.durationMin,0)+row.task.durationMin>settings.dailyMinutes) throw new UserError("Цей день уже заповнений. Оберіть інший.");
      await tx.studyTask.update({where:{id:row.taskId,userId},data:{dateKey:nextDate,status:"PLANNED",notes:`Перенесено вручну з ${row.task.dateKey}`}});
      await tx.externalPractice.update({where:{id},data:{status:"PLANNED"}});
    }
  });
}
