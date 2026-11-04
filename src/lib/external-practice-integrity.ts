import type { ExternalPractice, StudyTask, ExamResult, ExternalResultRevision } from "@prisma/client";
import { variantsFor, safeZnoUrl, externalResultSchema } from "./external-practice";
import { isDateKey } from "./dates";
import { UserError } from "./errors";

function invalid(): never { throw new UserError("Некоректні зв’язки або дані зовнішньої практики. Запис не виконано."); }
export function assertExternalAssignment(row: ExternalPractice, task: StudyTask | null | undefined, result: ExamResult | null | undefined) {
  const variant=variantsFor(row.subjectId).find(v=>v.number===row.variantNumber);
  if (!row.id || !row.taskId || row.provider!=="ZNO_ONLINE" || !Number.isInteger(row.variantNumber) || row.variantNumber<1 || !variant || !safeZnoUrl(row.url) || row.url!==variant.url || row.title!==variant.title || row.questionCount!==variant.questionCount || !isDateKey(row.initialDate) || !["PLANNED","PAUSED","COMPLETED","SKIPPED"].includes(row.status) || !Number.isInteger(row.version) || row.version<0) invalid();
  if (!task || task.id!==row.taskId || task.userId!==row.userId || task.subjectId!==row.subjectId || task.kind!=="mock" || task.templateKey!==`zno:${row.subjectId}:${row.variantNumber}`) invalid();
  const taskStatuses: Record<string,string[]>={PLANNED:["PLANNED","IN_PROGRESS"],PAUSED:["DROPPED"],COMPLETED:["DONE"],SKIPPED:["SKIPPED"]};
  if(!taskStatuses[row.status].includes(task.status)) invalid();
  if (row.resultId) {
    if (!result || result.id!==row.resultId || result.userId!==row.userId || result.subjectId!==row.subjectId || result.source!=="ZNO_ONLINE · SELF_REPORTED" || result.testType!=="MANUAL" || result.countsTowardAverage || result.title!==`Тренувальне НМТ-2027 · ${row.title}` || row.status!=="COMPLETED") invalid();
  } else if (result || row.status==="COMPLETED" || row.version!==0) invalid();
}
export function validateExternalBackup(data: {users:{id:string}[];subjects:{id:string}[];tasks:StudyTask[];examResults:ExamResult[];externalPractice:ExternalPractice[];externalResultRevisions:ExternalResultRevision[]}) {
  const indexed=<T extends {id:string}>(rows:T[])=>{
    if (!Array.isArray(rows)) invalid();
    const map=new Map(rows.map(r=>[r.id,r]));if(map.size!==rows.length) invalid();return map;
  };
  const users=indexed(data.users),subjects=indexed(data.subjects),tasks=indexed(data.tasks),results=indexed(data.examResults),assignments=indexed(data.externalPractice);
  const taskIds=new Set<string>(),resultIds=new Set<string>(),variants=new Set<string>();
  for (const row of assignments.values()) {
    if (!users.has(row.userId) || !subjects.has(row.subjectId) || taskIds.has(row.taskId) || (row.resultId && resultIds.has(row.resultId))) invalid();
    const key=JSON.stringify([row.userId,row.subjectId,row.variantNumber]);if(variants.has(key)) invalid();variants.add(key);taskIds.add(row.taskId);if(row.resultId)resultIds.add(row.resultId);
    assertExternalAssignment(row,tasks.get(row.taskId),row.resultId?results.get(row.resultId):null);
  }
  const revisions=indexed(data.externalResultRevisions),versions=new Set<string>();
  for(const revision of revisions.values()) {
    const row=assignments.get(revision.assignmentId);const key=JSON.stringify([revision.assignmentId,revision.version]);
    if(!row || !Number.isInteger(revision.version) || revision.version<1 || revision.version>row.version || versions.has(key)) invalid();versions.add(key);
    const parsed=externalResultSchema.safeParse({...JSON.parse(revision.snapshotJson),assignmentId:row.id,version:revision.version});
    if(!parsed.success || (parsed.data.errorCount!==null && parsed.data.errorCount>row.questionCount)) invalid();
  }
  for(const row of assignments.values()) {
    const history=[...revisions.values()].filter(r=>r.assignmentId===row.id);
    if(history.length!==row.version || (row.resultId && row.version<1)) invalid();
  }
}
