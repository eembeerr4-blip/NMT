import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { dateKey, parseDateKey, addDateKeys } from "@/lib/dates";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE } from "@/lib/constants";
import { variantsFor } from "@/lib/external-practice";

const auth=vi.hoisted(()=>({user:{id:"owner",role:"OWNER",accountStatus:"APPROVED",onboarded:true,subjects:[]} as {id:string;role:string;accountStatus:string;onboarded:boolean;subjects:{subjectId:string;active:boolean;role:string}[]}}));
vi.mock("@/lib/prisma",async()=>{
  const {PrismaClient}=await import("@prisma/client");
  const folder=mkdtempSync(path.join(tmpdir(),"nmt-external-practice-"));
  const database=path.join(folder,"isolated-qa.db");
  const url="file:"+database.replaceAll("\\","/")+"?connection_limit=1";
  return {prisma:new PrismaClient({datasourceUrl:url}),folder,database,url};
});
vi.mock("@/server/session",()=>({getSessionUser:()=>auth.user,requireUser:()=>auth.user,clearSession:vi.fn(),createSession:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/headers",()=>({headers:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error("REDIRECT:"+url);}}));
import { prisma } from "@/lib/prisma";
import { syncExternalPractice, externalAssignments, saveExternalResultFor, changeExternalTaskFor, externalPracticeReady } from "./external-practice";
import { syncPlanWithClient } from "./sync";
import { savePracticeSchedule } from "./external-practice-actions";
import { buildBackup, restoreBackup, saveExamResult, deleteExamResult, setTaskStatus, moveTask } from "./actions";

beforeAll(async()=>{
  const {url,database}=await import("@/lib/prisma") as unknown as {url:string;database:string};
  expect(database.replaceAll("\\","/")).not.toContain("/prisma/dev.db");
  writeFileSync(database, "");
  execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url},stdio:"pipe"});
});
beforeEach(async()=>{
  await prisma.externalResultRevision.deleteMany();await prisma.externalPractice.deleteMany();await prisma.examResult.deleteMany();await prisma.studyTask.deleteMany();await prisma.auditLog.deleteMany();
  await prisma.userSubject.deleteMany();await prisma.userSettings.deleteMany();await prisma.user.deleteMany();
  for(const id of ["math","ukrainian","history","geography","biology"])await prisma.subject.upsert({where:{id},create:{id,name:id,shortName:id,description:"Synthetic QA",color:"#123456",sortOrder:0},update:{}});
  for(const id of ["owner","other"]) {
    await prisma.user.create({data:{id,nickname:id,firstName:"Synthetic QA",role:id==="owner"?"OWNER":"STUDENT",passwordHash:"synthetic-fixture-not-a-real-password",onboarded:true,accountStatus:"APPROVED"}});
    for(const subjectId of ["math","ukrainian","history","biology"])await prisma.userSubject.create({data:{userId:id,subjectId,active:true,role:subjectId==="biology"?"ELECTIVE":"REQUIRED"}});
    await prisma.userSettings.create({data:{id,userId:id,planStart:dateKey(),dailyMinutes:180,studyDaysJson:"[1,2,3,4,5,6]",scheduleJson:JSON.stringify({...DEFAULT_SCHEDULE,externalPractice:{enabled:true,days:[6],durationMin:60}}),formatJson:JSON.stringify(DEFAULT_FORMAT)}});
  }
  auth.user={id:"owner",role:"OWNER",accountStatus:"APPROVED",onboarded:true,subjects:[]};
});
afterAll(async()=>{await prisma.$disconnect();const {folder}=await import("@/lib/prisma") as unknown as {folder:string};rmSync(folder,{recursive:true});});
const input=(id:string,version=0)=>({assignmentId:id,version,date:dateKey(),rawScore:25,maxRawScore:null,ratingScore:150,errorCount:2,comment:"QA"});
const first=async()=>{await syncExternalPractice("owner");return (await externalAssignments("owner")).find(r=>r.subjectId==="math")!;};
it("applies the additive migration and keeps another user's sequence independent",async()=>{
  expect(await externalPracticeReady()).toBe(true);
  await syncExternalPractice("owner");await syncExternalPractice("other");
  for(const id of ["owner","other"]) {const rows=await externalAssignments(id);expect(rows).toHaveLength(4);expect(rows.every(r=>r.variantNumber===1)).toBe(true);}
  expect((await externalAssignments("nobody"))).toEqual([]);
});
it("three ordinary syncPlan calls do not duplicate assignments or advance variants",async()=>{
  await syncPlanWithClient("owner");const before=await externalAssignments("owner");
  await syncPlanWithClient("owner");await syncPlanWithClient("owner");
  expect(await externalAssignments("owner")).toEqual(before);
  expect(await prisma.studyTask.count({where:{templateKey:{startsWith:"zno:"}}})).toBe(4);
});
it("never assigns a rest day and stays within the daily budget across month boundaries",async()=>{
  await syncExternalPractice("owner",prisma,"2026-10-30");
  const rows=await externalAssignments("owner");
  expect(rows.every(r=>parseDateKey(r.task.dateKey).getDay()===6)).toBe(true);
  expect(rows.some(r=>r.task.dateKey.startsWith("2026-11"))).toBe(true);
  expect(rows.every(r=>r.task.durationMin<=180)).toBe(true);
});
it("one preferred day rotates four subjects without overloading the day",async()=>{
  const r=await first();const all=await externalAssignments("owner");expect(new Set(all.map(a=>a.task.dateKey)).size).toBe(4);expect(r.variantNumber).toBe(1);
});
it("completing math advances only math, not the other subjects or users",async()=>{
  const row=await first();await saveExternalResultFor("owner",input(row.id));await syncExternalPractice("owner");
  const rows=await externalAssignments("owner");expect(rows.filter(r=>r.subjectId==="math").map(r=>r.variantNumber)).toEqual([1,2]);
  expect(rows.filter(r=>r.subjectId!=="math").every(r=>r.variantNumber===1)).toBe(true);
  await syncExternalPractice("other");expect((await externalAssignments("other")).every(r=>r.variantNumber===1)).toBe(true);
});
it("an explicit skip advances the subject and retains historical task identity",async()=>{
  const row=await first();await changeExternalTaskFor("owner",row.id,"skip");await syncExternalPractice("owner");
  expect(await prisma.studyTask.findUnique({where:{id:row.taskId}})).toMatchObject({status:"SKIPPED"});
  expect((await externalAssignments("owner")).filter(r=>r.subjectId==="math")).toHaveLength(2);
});
it("missed assignments keep their original variant and remain available",async()=>{
  const row=await first();await prisma.studyTask.update({where:{id:row.taskId},data:{dateKey:addDateKeys(dateKey(),-7)}});
  await syncExternalPractice("owner");await syncExternalPractice("owner");
  expect((await externalAssignments("owner")).filter(r=>r.subjectId==="math")).toHaveLength(1);
  expect(await prisma.studyTask.findUnique({where:{id:row.taskId}})).toMatchObject({dateKey:addDateKeys(dateKey(),-7),status:"PLANNED"});
});
it("manual moves reject rest days and preserve variant and URL after reload/sync",async()=>{
  const row=await first();let sunday=dateKey();while(parseDateKey(sunday).getDay()!==0)sunday=addDateKeys(sunday,1);
  await expect(changeExternalTaskFor("owner",row.id,"move",sunday)).rejects.toThrow();
  let monday=addDateKeys(sunday,1);while((await externalAssignments("owner")).some(r=>r.task.dateKey===monday))monday=addDateKeys(monday,7);
  await changeExternalTaskFor("owner",row.id,"move",monday);await syncExternalPractice("owner");
  expect(await prisma.externalPractice.findUnique({where:{id:row.id},include:{task:true}})).toMatchObject({variantNumber:1,url:row.url,task:{dateKey:monday}});
});
it("schedule changes preserve completed results and reschedule only future unfinished tasks",async()=>{
  const row=await first();await saveExternalResultFor("owner",input(row.id));
  const historical=await prisma.externalPractice.findUnique({where:{id:row.id},include:{task:true,result:true}});
  expect(await savePracticeSchedule({enabled:true,days:[5],durationMin:45})).toMatchObject({ok:true});
  expect(await prisma.externalPractice.findUnique({where:{id:row.id},include:{task:true,result:true}})).toEqual(historical);
  const future=(await externalAssignments("owner")).filter(r=>r.status==="PLANNED");expect(future.every(r=>parseDateKey(r.task.dateKey).getDay()===5)).toBe(true);
});
it("insufficient time and disabled/rest-only schedules do not create compulsory mocks",async()=>{
  await prisma.userSettings.update({where:{userId:"owner"},data:{dailyMinutes:30}});await syncExternalPractice("owner");expect(await externalAssignments("owner")).toEqual([]);
  expect(await savePracticeSchedule({enabled:true,days:[0],durationMin:20})).toMatchObject({ok:false});
});
it("elective switching pauses future old assignments without deleting them",async()=>{
  await first();await prisma.userSubject.updateMany({where:{userId:"owner",subjectId:"biology"},data:{active:false}});
  await prisma.userSubject.create({data:{userId:"owner",subjectId:"geography",role:"ELECTIVE",active:true}});await syncExternalPractice("owner");
  expect((await externalAssignments("owner")).find(r=>r.subjectId==="biology")?.status).toBe("PAUSED");
  expect((await externalAssignments("owner")).find(r=>r.subjectId==="geography")?.variantNumber).toBe(1);
});
it("result double-submit is idempotent, score edits retain revision history, no fake learning records",async()=>{
  const row=await first();const learning=async()=>[await prisma.answer.count(),await prisma.testAttempt.count(),await prisma.mistake.count(),await prisma.userTopicProgress.count()];const before=await learning();
  const id=await saveExternalResultFor("owner",input(row.id));expect(await saveExternalResultFor("owner",input(row.id))).toBe(id);
  expect(await prisma.examResult.count()).toBe(1);expect(await prisma.externalResultRevision.count()).toBe(1);
  await expect(saveExternalResultFor("owner",{...input(row.id),rawScore:26})).rejects.toThrow(/Оновіть/);
  await saveExternalResultFor("owner",{...input(row.id,1),rawScore:26});expect(await prisma.externalResultRevision.count()).toBe(2);
  expect(await prisma.examResult.findUnique({where:{id}})).toMatchObject({source:"ZNO_ONLINE · SELF_REPORTED",rawScore:26,maxRawScore:null,countsTowardAverage:false});
  expect(await learning()).toEqual(before);
});
it("foreign users cannot submit, skip or move an assignment",async()=>{
  const row=await first();for(const op of [()=>saveExternalResultFor("other",input(row.id)),()=>changeExternalTaskFor("other",row.id,"skip"),()=>changeExternalTaskFor("other",row.id,"move",dateKey())])await expect(op()).rejects.toThrow();
  expect(await prisma.examResult.count()).toBe(0);
});
it("legacy generic task/result actions cannot bypass external revision/progression rules",async()=>{
  const row=await first();expect(await setTaskStatus(row.taskId,"DONE")).toMatchObject({ok:false});expect(await moveTask(row.taskId,dateKey())).toMatchObject({ok:false});
  const resultId=await saveExternalResultFor("owner",input(row.id));expect(await deleteExamResult(resultId)).toMatchObject({ok:false});
  expect(await saveExamResult({id:resultId,date:dateKey(),subjectId:"math",title:"overwrite",testType:"MANUAL",source:"",rawScore:1,maxRawScore:null,ratingScore:null,belowThreshold:false,partial:false,countsTowardAverage:false,durationMin:null,errorCount:null,comment:""})).toMatchObject({ok:false});
});
it("invalid external scores never create a result",async()=>{
  const row=await first();await expect(saveExternalResultFor("owner",{...input(row.id),errorCount:100})).rejects.toThrow();await expect(saveExternalResultFor("owner",{...input(row.id),maxRawScore:1})).rejects.toThrow();expect(await prisma.examResult.count()).toBe(0);
});
it("the last catalog variant is finite and exhaustion never invents another URL",async()=>{
  await prisma.userSubject.updateMany({where:{userId:"owner"},data:{active:false}});await prisma.userSubject.create({data:{userId:"owner",subjectId:"geography",role:"ELECTIVE",active:true}});
  for(const v of variantsFor("geography")) {const task=await prisma.studyTask.create({data:{userId:"owner",subjectId:"geography",dateKey:"2026-01-01",title:v.title,kind:"mock",templateKey:`zno:geography:${v.number}`,durationMin:60,status:"SKIPPED"}});await prisma.externalPractice.create({data:{userId:"owner",subjectId:"geography",variantNumber:v.number,title:v.title,url:v.url,questionCount:v.questionCount,initialDate:"2026-01-01",taskId:task.id,status:"SKIPPED"}});}
  await syncExternalPractice("owner");expect(await prisma.externalPractice.count({where:{userId:"owner"}})).toBe(8);
});
it("backup v6 exports and restores assignments, results and revision history in isolated SQLite",async()=>{
  const row=await first();await saveExternalResultFor("owner",input(row.id));const saved=await buildBackup();expect(saved.version).toBe(6);expect(saved.externalPractice).toHaveLength(4);expect(saved.externalResultRevisions).toHaveLength(1);
  expect(await restoreBackup(JSON.stringify(saved),"ВІДНОВИТИ")).toMatchObject({ok:true});
  expect(await prisma.externalPractice.count()).toBe(4);expect(await prisma.externalResultRevision.count()).toBe(1);expect(await prisma.examResult.count()).toBe(1);
  expect(await prisma.$queryRaw`PRAGMA foreign_key_check`).toEqual([]);
});

it("concurrent SQLite clients reserve each subject variant once",async()=>{
  const {PrismaClient}=await import("@prisma/client");
  const {url}=await import("@/lib/prisma") as unknown as {url:string};
  const second=new PrismaClient({datasourceUrl:url});
  try {
    await Promise.all([syncExternalPractice("owner"),syncExternalPractice("owner",second)]);
    expect(await prisma.externalPractice.count({where:{userId:"owner"}})).toBe(4);
    expect(await prisma.studyTask.count({where:{userId:"owner",templateKey:{startsWith:"zno:"}}})).toBe(4);
  } finally {await second.$disconnect();}
});
it("a new rest day reschedules a future manually moved assignment without losing its variant",async()=>{
  const row=await first();let monday=dateKey();while(parseDateKey(monday).getDay()!==1)monday=addDateKeys(monday,1);
  await changeExternalTaskFor("owner",row.id,"move",monday);
  await prisma.userSettings.update({where:{userId:"owner"},data:{studyDaysJson:"[6]"}});
  await syncExternalPractice("owner");
  const after=await prisma.externalPractice.findUniqueOrThrow({where:{id:row.id},include:{task:true}});
  expect(parseDateKey(after.task.dateKey).getDay()).toBe(6);
  expect(after.variantNumber).toBe(row.variantNumber);expect(after.url).toBe(row.url);
});

import { createHash } from "node:crypto";
async function stateHash(){const tables=["StudyTask","ExternalPractice","ExternalResultRevision","ExamResult","UserSettings","AuditLog","Test","TestAttempt","Answer","Mistake","ReviewSchedule","UserTopicProgress"];const data=[];for(const table of tables)data.push(await prisma.$queryRawUnsafe('SELECT * FROM "'+table+'" ORDER BY rowid'));return createHash("sha256").update(JSON.stringify(data)).digest("hex");}
import { saveExternalResult, changeExternalTask } from "@/server/external-practice-actions";
it("REVIEW: re-enabling after a paused date must reactivate the subject",async()=>{
  vi.useFakeTimers({toFake:["Date"]});
  try {
    vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    await syncExternalPractice("owner");
    const firstRow=(await externalAssignments("owner")).find(r=>r.subjectId==="math")!;
    await savePracticeSchedule({enabled:false,days:[6],durationMin:60});
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    await savePracticeSchedule({enabled:true,days:[6],durationMin:60});
    const rows=(await externalAssignments("owner")).filter(r=>r.subjectId==="math");
    console.log("REVIEW paused/reactivated:",rows.map(r=>({variant:r.variantNumber,status:r.status,taskStatus:r.task.status,date:r.task.dateKey})));
    expect(rows.some(r=>r.status==="PLANNED"&&r.task.status==="PLANNED"&&r.task.dateKey>=dateKey())).toBe(true);
    expect(rows[0].variantNumber).toBe(firstRow.variantNumber);
  } finally {vi.useRealTimers();}
});
it("REVIEW: editing a self-report must preserve the original completion timestamp",async()=>{
  vi.useFakeTimers({toFake:["Date"]});
  try {
    vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const row=await first();await saveExternalResultFor("owner",input(row.id));
    const before=await prisma.studyTask.findUniqueOrThrow({where:{id:row.taskId}});
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    await saveExternalResultFor("owner",{...input(row.id,1),rawScore:26});
    const after=await prisma.studyTask.findUniqueOrThrow({where:{id:row.taskId}});
    console.log("REVIEW completion timestamp:",{before:before.completedAt,after:after.completedAt,revisions:await prisma.externalResultRevision.count()});
    expect(after.completedAt).toEqual(before.completedAt);
  } finally {vi.useRealTimers();}
});
it("REVIEW: a direct schedule action must not leave the day above the minute limit",async()=>{
  let friday=dateKey();while(parseDateKey(friday).getDay()!==5)friday=addDateKeys(friday,1);
  await prisma.studyTask.create({data:{userId:"owner",subjectId:"math",dateKey:friday,templateKey:"d5-s0",kind:"study",title:"Synthetic existing automatic lesson",durationMin:150}});
  expect(await savePracticeSchedule({enabled:true,days:[5],durationMin:60})).toMatchObject({ok:true});
  const tasks=await prisma.studyTask.findMany({where:{userId:"owner",dateKey:friday,status:"PLANNED"}});
  const minutes=tasks.reduce((s,t)=>s+t.durationMin,0);
  console.log("REVIEW direct schedule load:",{date:friday,minutes,limit:180,tasks:tasks.map(t=>({kind:t.kind,duration:t.durationMin}))});
  expect(minutes).toBeLessThanOrEqual(180);
});
it("REVIEW: invalid restored variant metadata is rejected before any changes",async()=>{const row=await first();const backup=await buildBackup();const target=backup.externalPractice.find(r=>r.id===row.id)!;target.variantNumber=-1;target.url="https://example.invalid/not-zno";const before=await stateHash();expect(await restoreBackup(JSON.stringify(backup),"ВІДНОВИТИ")).toMatchObject({ok:false});expect(await stateHash()).toBe(before);await prisma.externalPractice.update({where:{id:row.id},data:{variantNumber:-1,url:target.url}});expect(await saveExternalResult(input(row.id))).toMatchObject({ok:false});expect(await prisma.examResult.count()).toBe(0);});
it("REVIEW: cross-user backup rejection and corrupt live rows cannot modify another user's task",async()=>{const row=await first();const backup=await buildBackup();backup.externalPractice.find(r=>r.id===row.id)!.userId="other";const before=await stateHash();expect(await restoreBackup(JSON.stringify(backup),"ВІДНОВИТИ")).toMatchObject({ok:false});expect(await stateHash()).toBe(before);await prisma.externalPractice.update({where:{id:row.id},data:{userId:"other"}});auth.user={id:"other",role:"STUDENT",accountStatus:"APPROVED",onboarded:true,subjects:[]};const corruptBefore=await stateHash();expect(await savePracticeSchedule({enabled:true,days:[5],durationMin:45})).toMatchObject({ok:false});expect(await saveExternalResult(input(row.id))).toMatchObject({ok:false});expect(await changeExternalTask(row.id,"skip")).toMatchObject({ok:false});expect(await stateHash()).toBe(corruptBefore);});
it("REVIEW: client-supplied user, subject, task and URL cannot override an owned assignment",async()=>{
  const row=await first();
  expect(await saveExternalResult({...input(row.id),userId:"other",subjectId:"biology",taskId:"foreign",url:"javascript:alert(1)"} as never)).toMatchObject({ok:true});
  const result=await prisma.examResult.findFirstOrThrow({where:{userId:"owner"}});
  expect(result.subjectId).toBe("math");expect(await prisma.examResult.count({where:{userId:"other"}})).toBe(0);
});
it("REVIEW: adding catalog entries does not renumber existing assignments",async()=>{
  await first();const before=await externalAssignments("owner");
  const {znoCatalog}=await import("@/lib/external-practice");
  znoCatalog.variants.push({...znoCatalog.variants[0],number:999,title:"Synthetic review-only catalog addition"});
  try {await syncExternalPractice("owner");expect(await externalAssignments("owner")).toEqual(before);}
  finally {znoCatalog.variants.pop();}
});

it.each([0,-1,999])("rejects invalid restored variant number %s atomically",async number=>{const row=await first();const data=await buildBackup();data.externalPractice.find(a=>a.id===row.id)!.variantNumber=number;const before=await stateHash();expect(await restoreBackup(JSON.stringify(data),"ВІДНОВИТИ")).toMatchObject({ok:false});expect(await stateHash()).toBe(before);});
it.each(["provider","url","subject","task","result-owner","result-subject","revision"])("rejects inconsistent backup %s before writes",async field=>{const row=await first();await saveExternalResultFor("owner",input(row.id));const data=await buildBackup();const a=data.externalPractice.find(x=>x.id===row.id)!;if(field==="provider")a.provider="OTHER";if(field==="url")a.url=variantsFor("math")[1].url;if(field==="subject")a.subjectId="biology";if(field==="task")data.tasks.find(x=>x.id===a.taskId)!.subjectId="biology";if(field==="result-owner")data.examResults.find(x=>x.id===a.resultId)!.userId="other";if(field==="result-subject")data.examResults.find(x=>x.id===a.resultId)!.subjectId="biology";if(field==="revision")data.externalResultRevisions[0].assignmentId="missing";const before=await stateHash();expect(await restoreBackup(JSON.stringify(data),"ВІДНОВИТИ")).toMatchObject({ok:false});expect(await stateHash()).toBe(before);});
it("keeps completedAt through three edits and duplicate submission, preserving revision dates",async()=>{vi.useFakeTimers({toFake:["Date"]});try{vi.setSystemTime(new Date("2026-10-27T12:00Z"));const row=await first();await saveExternalResultFor("owner",input(row.id));const original=await prisma.studyTask.findUniqueOrThrow({where:{id:row.taskId}});for(let version=1;version<=3;version++){vi.setSystemTime(new Date(1793102400000+version*86400000));await saveExternalResultFor("owner",{...input(row.id,version),rawScore:25+version});expect((await prisma.studyTask.findUniqueOrThrow({where:{id:row.taskId}})).completedAt).toEqual(original.completedAt);}await saveExternalResultFor("owner",{...input(row.id,3),rawScore:28});expect(await prisma.externalResultRevision.count()).toBe(4);const revisions=await prisma.externalResultRevision.findMany({orderBy:{version:"asc"}});expect(new Set(revisions.map(r=>r.createdAt.toISOString())).size).toBe(4);}finally{vi.useRealTimers();}});
it.each([150,180,210])("enforces daily capacity %s across repeated schedule saves",async cap=>{await prisma.userSettings.update({where:{userId:"owner"},data:{dailyMinutes:cap}});let friday=dateKey();while(parseDateKey(friday).getDay()!==5)friday=addDateKeys(friday,1);await prisma.studyTask.create({data:{userId:"owner",subjectId:"math",dateKey:friday,templateKey:"d5-s0",kind:"study",title:"Synthetic load",durationMin:150}});for(let i=0;i<3;i++)expect(await savePracticeSchedule({enabled:true,days:[5],durationMin:60})).toMatchObject({ok:true});const rows=await prisma.studyTask.findMany({where:{userId:"owner",status:{in:["PLANNED","IN_PROGRESS","DONE"]}}});for(const day of new Set(rows.map(t=>t.dateKey)))expect(rows.filter(t=>t.dateKey===day).reduce((n,t)=>n+t.durationMin,0)).toBeLessThanOrEqual(cap);expect(await prisma.externalPractice.count()).toBe(4);});
it("reactivates two paused subjects after several rest days without duplicating or renumbering",async()=>{vi.useFakeTimers({toFake:["Date"]});try{vi.setSystemTime(new Date("2026-10-27T12:00Z"));await prisma.userSubject.updateMany({where:{userId:"owner",subjectId:{in:["history","biology"]}},data:{active:false}});await syncExternalPractice("owner");const original=await externalAssignments("owner");await savePracticeSchedule({enabled:false,days:[6],durationMin:60});vi.setSystemTime(new Date("2026-11-16T12:00Z"));await savePracticeSchedule({enabled:true,days:[6],durationMin:60});await syncPlanWithClient("owner");await syncPlanWithClient("owner");const rows=await externalAssignments("owner");expect(rows).toHaveLength(2);for(const row of rows){expect(row.status).toBe("PLANNED");expect(row.variantNumber).toBe(1);expect(row.initialDate).toBe(original.find(a=>a.id===row.id)!.initialDate);expect(row.task.dateKey>="2026-11-16").toBe(true);expect(parseDateKey(row.task.dateKey).getDay()).toBe(6);expect(row.task.notes).toContain("Розклад змінено");}}finally{vi.useRealTimers();}});
it("concurrent reservations and moves respect the same user's capacity",async()=>{await prisma.userSettings.update({where:{userId:"owner"},data:{dailyMinutes:150}});let friday=dateKey();while(parseDateKey(friday).getDay()!==5)friday=addDateKeys(friday,1);await prisma.studyTask.create({data:{userId:"owner",dateKey:friday,subjectId:"math",kind:"study",title:"Synthetic load",durationMin:90}});await Promise.all([savePracticeSchedule({enabled:true,days:[5],durationMin:60}),savePracticeSchedule({enabled:true,days:[5],durationMin:60})]);const rows=await externalAssignments("owner");const second=rows.find(r=>r.task.dateKey!==friday)!;await expect(changeExternalTaskFor("owner",second.id,"move",friday)).rejects.toThrow();const tasks=await prisma.studyTask.findMany({where:{userId:"owner",dateKey:friday,status:"PLANNED"}});expect(tasks.reduce((n,t)=>n+t.durationMin,0)).toBe(150);});

it("rejects external rows hidden in a downgraded v5 backup atomically",async()=>{await first();const backup=await buildBackup();const before=await stateHash();expect(await restoreBackup(JSON.stringify({...backup,version:5}),"ВІДНОВИТИ")).toMatchObject({ok:false});expect(await stateHash()).toBe(before);});
it("corrupt result ownership blocks editing without touching either user",async()=>{const row=await first();const resultId=await saveExternalResultFor("owner",input(row.id));await prisma.examResult.update({where:{id:resultId},data:{userId:"other"}});const before=await stateHash();expect(await saveExternalResult({...input(row.id,1),rawScore:26})).toMatchObject({ok:false});await expect(externalAssignments("owner")).rejects.toThrow();expect(await stateHash()).toBe(before);});
