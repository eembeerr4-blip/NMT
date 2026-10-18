import { afterAll, beforeAll, expect, it, vi, describe } from "vitest";
vi.mock("@/server/session",()=>({getSessionUser:vi.fn(async()=>({id:"owner"}))}));
import { prisma } from "../src/lib/prisma";
import { syncPlan } from "../src/server/sync";
describe.skipIf(process.env.NMT_AUDIT_DB!=="1")("planning with manual work and changed days",()=>{
 beforeAll(()=>{if(process.env.DATABASE_URL!=="file:./audit-20261017.e2e.db")throw new Error("Disposable database required")});
 afterAll(()=>prisma.$disconnect());
 it("caps generated work, retains completed tasks and respects changed weekdays",async()=>{
  const learner=await prisma.user.findUniqueOrThrow({where:{nickname:"audit_second_1017"}});
  const original=await prisma.userSettings.findUniqueOrThrow({where:{userId:learner.id}});
  const day="2026-10-19";
  await prisma.studyTask.deleteMany({where:{userId:learner.id,title:{in:["Audit custom retained","Audit done retained"]}}});
  try{
   await prisma.userSettings.update({where:{userId:learner.id},data:{dailyMinutes:60,studyDaysJson:"[1]"}});
   const manual=await prisma.studyTask.create({data:{userId:learner.id,dateKey:day,title:"Audit custom retained",kind:"study",durationMin:25,status:"PLANNED"}});
   const done=await prisma.studyTask.create({data:{userId:learner.id,dateKey:day,title:"Audit done retained",kind:"study",durationMin:15,status:"DONE"}});
   await syncPlan(learner.id);
   let tasks=await prisma.studyTask.findMany({where:{userId:learner.id,dateKey:day,status:{in:["PLANNED","IN_PROGRESS","DONE"]}}});
   expect(tasks.reduce((sum,t)=>sum+t.durationMin,0)).toBeLessThanOrEqual(60);
   expect(tasks.find(t=>t.id===manual.id)?.durationMin).toBe(25);
   expect(tasks.find(t=>t.id===done.id)?.status).toBe("DONE");
   await prisma.userSettings.update({where:{userId:learner.id},data:{dailyMinutes:45,studyDaysJson:"[2]"}});
   await Promise.all([syncPlan(learner.id),syncPlan(learner.id)]);
   tasks=await prisma.studyTask.findMany({where:{userId:learner.id,dateKey:day}});
   expect(tasks.filter(t=>t.templateKey&&t.status==="PLANNED")).toHaveLength(0);
   expect(tasks.find(t=>t.id===done.id)?.status).toBe("DONE");
   expect(tasks.find(t=>t.id===manual.id)?.status).toBe("PLANNED");
   const tuesday=await prisma.studyTask.findMany({where:{userId:learner.id,dateKey:"2026-10-20",status:{in:["PLANNED","IN_PROGRESS","DONE"]}}});
   expect(tuesday.reduce((sum,t)=>sum+t.durationMin,0)).toBeLessThanOrEqual(45);
   expect(new Set(tuesday.filter(t=>t.templateKey).map(t=>t.templateKey)).size).toBe(tuesday.filter(t=>t.templateKey).length);
  }finally{await prisma.studyTask.deleteMany({where:{userId:learner.id,title:{in:["Audit custom retained","Audit done retained"]}}});await prisma.userSettings.update({where:{id:original.id},data:{dailyMinutes:original.dailyMinutes,studyDaysJson:original.studyDaysJson}});await syncPlan(learner.id)}
 },20000);
});
