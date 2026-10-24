import {afterAll,beforeAll,expect,it,vi} from "vitest";
import {execFileSync} from "node:child_process";
import {writeFileSync,unlinkSync,rmdirSync,existsSync} from "node:fs";
import path from "node:path";
const auth=vi.hoisted(()=>({id:"learner-a"}));
vi.mock("@/lib/prisma",async()=>{const {PrismaClient}=await import("@prisma/client");const {mkdtempSync}=await import("node:fs");const {tmpdir}=await import("node:os");const path=await import("node:path");const folder=mkdtempSync(path.join(tmpdir(),"nmt-hardening-"));const database=path.join(folder,"isolated.db");return {prisma:new PrismaClient({datasources:{db:{url:"file:"+database.replaceAll("\\","/")}}}),folder,database};});
vi.mock("@/server/session",()=>({getSessionUser:()=>prisma.user.findUnique({where:{id:auth.id},include:{subjects:true}}),requireUser:()=>prisma.user.findUniqueOrThrow({where:{id:auth.id},include:{subjects:true}}),createSession:vi.fn(),clearSession:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/headers",()=>({headers:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn(),notFound:()=>{throw new Error("NOT_FOUND")},useRouter:vi.fn()}));
vi.mock("@/server/sync",async()=>({...await vi.importActual<typeof import("@/server/sync")>("@/server/sync"),syncPlan:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {initializeSQLite} from "@/lib/sqlite-init";
import {DEFAULT_FORMAT,DEFAULT_SCHEDULE} from "@/lib/constants";
import {buildBackup,restoreBackup,saveExamResult,saveDraft,finishAttempt,deleteExamResult,setTaskStatus,moveTask,reviewFlashcard,setMistakeMeta,updateUserRole} from "@/server/actions";
import {subjectPriorities} from "@/server/progress";
import {revalidatePath} from "next/cache";
import MistakesPage from "@/app/(main)/mistakes/page";
import ResultsPage from "@/app/(main)/results/page";
import TestsPage from "@/app/(main)/tests/page";
import CalendarPage from "@/app/(main)/calendar/page";
import AttemptPage from "@/app/(main)/tests/[id]/page";
import {getSettings} from "@/server/sync";
const exam={date:"2026-10-18",subjectId:"math",testType:"MANUAL",title:"PRIVATE_A_RESULT",source:"QA",rawScore:null,maxRawScore:null,ratingScore:150,belowThreshold:false,partial:false,countsTowardAverage:true,durationMin:null,errorCount:null,comment:""};
let resultId:string,taskId:string;
function view(value:unknown){return JSON.stringify(value,(key,item)=>["type","_owner","_store"].includes(key)?undefined:item);}
beforeAll(async()=>{
 const fixture=await import("@/lib/prisma") as unknown as {database:string};writeFileSync(fixture.database,"");execFileSync(process.execPath,[path.join(process.cwd(),"node_modules/prisma/build/index.js"),"migrate","deploy"],{env:{...process.env,DATABASE_URL:"file:"+fixture.database.replaceAll("\\","/")},stdio:"pipe",timeout:60000});await initializeSQLite(prisma);
 for(const id of ["owner","learner-a","learner-b"]){await prisma.user.create({data:{id,nickname:id,firstName:id,onboarded:true,accountStatus:"APPROVED",role:id==="owner"?"ADMIN":"STUDENT",passwordHash:"QA-only-unused-hash"}});await prisma.userSettings.create({data:{id:id==="owner"?"default":id,userId:id,mathPriority:id==="owner"?99:id==="learner-b"?17:35,scheduleJson:JSON.stringify(DEFAULT_SCHEDULE),formatJson:JSON.stringify(DEFAULT_FORMAT)}});}
 await prisma.subject.create({data:{id:"math",name:"Математика",shortName:"Математика",description:"QA",color:"#000",sortOrder:0}});
 for(const userId of ["owner","learner-a","learner-b"])await prisma.userSubject.create({data:{userId,subjectId:"math",role:"mandatory",active:true}});
 await prisma.topic.create({data:{id:"qa-topic",subjectId:"math",title:"QA topic",sortOrder:0}});
 await prisma.question.create({data:{id:"qa-question",subjectId:"math",topicId:"qa-topic",type:"NUMERIC",difficulty:"EASY",prompt:"2+2",correctAnswer:"4",explanation:"4",verificationStatus:"VERIFIED"}});
 await prisma.test.create({data:{id:"qa-test",subjectId:"math",topicId:"qa-topic",title:"PRIVATE_A_ATTEMPT",kind:"TOPIC",questions:{create:{questionId:"qa-question",sortOrder:0}}}});
 auth.id="learner-a";expect((await saveExamResult(exam)).ok).toBe(true);
 await prisma.studyTask.create({data:{userId:auth.id,dateKey:"2026-10-18",title:"PRIVATE_A_TASK",durationMin:20,kind:"study",templateKey:"qa-task-a"}});
 await prisma.testAttempt.create({data:{id:"private-attempt",testId:"qa-test",userId:auth.id}});
 await prisma.mistake.create({data:{id:"private-mistake",subjectId:"math",topicId:"qa-topic",prompt:"PRIVATE_A_MISTAKE",userAnswer:"1",correctAnswer:"4",explanation:"QA",userId:auth.id}});
 await prisma.flashcard.create({data:{id:"private-card",userId:auth.id,front:"A card",back:"4",kind:"formula",dueKey:"2026-10-18"}});
 resultId=(await prisma.examResult.findFirstOrThrow({where:{userId:auth.id}})).id;taskId=(await prisma.studyTask.findFirstOrThrow({where:{userId:auth.id}})).id;
},60000);
afterAll(async()=>{await prisma.$disconnect();const fixture=await import("@/lib/prisma") as unknown as {folder:string;database:string};for(const suffix of ["","-wal","-shm"]){if(existsSync(fixture.database+suffix))unlinkSync(fixture.database+suffix);}rmdirSync(fixture.folder);});

it("A sees own data; B's real pages contain none of A's records",async()=>{
 auth.id="learner-a";expect(view(await ResultsPage({searchParams:Promise.resolve({})}))).toContain("PRIVATE_A_RESULT");expect(view(await TestsPage())).toContain("PRIVATE_A_ATTEMPT");expect(view(await MistakesPage({searchParams:Promise.resolve({})}))).toContain("PRIVATE_A_MISTAKE");expect(view(await CalendarPage({searchParams:Promise.resolve({date:"2026-10-18",view:"day"})}))).toContain("PRIVATE_A_TASK");
 auth.id="learner-b";for(const page of [await ResultsPage({searchParams:Promise.resolve({})}),await TestsPage(),await MistakesPage({searchParams:Promise.resolve({})}),await CalendarPage({searchParams:Promise.resolve({date:"2026-10-18",view:"day"})})])expect(view(page)).not.toContain("PRIVATE_A_");
 for(const rows of [await prisma.mistake.findMany({where:{userId:auth.id}}),await prisma.examResult.findMany({where:{userId:auth.id}}),await prisma.testAttempt.findMany({where:{userId:auth.id}}),await prisma.studyTask.findMany({where:{userId:auth.id}})])expect(rows).toEqual([]);
});
it("B cannot read A's attempt page, save its draft or finish it",async()=>{auth.id="learner-b";await expect(AttemptPage({params:Promise.resolve({id:"private-attempt"})})).rejects.toThrow("NOT_FOUND");expect((await saveDraft("private-attempt",{},0)).ok).toBe(false);expect((await finishAttempt("private-attempt",{})).ok).toBe(false);expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:"private-attempt"}})).status).toBe("IN_PROGRESS");});
it("B cannot edit or delete A's exam result",async()=>{auth.id="learner-b";expect((await saveExamResult({...exam,id:resultId,title:"changed"})).ok).toBe(false);expect((await deleteExamResult(resultId)).ok).toBe(false);expect((await deleteExamResult(resultId,true)).ok).toBe(false);expect((await prisma.examResult.findUniqueOrThrow({where:{id:resultId}})).title).toBe("PRIVATE_A_RESULT");});
it("owner can delete own seed result only after acknowledgement",async()=>{
 auth.id="learner-a";
 await prisma.examResult.create({data:{id:"seed-qa-hardening",userId:auth.id,subjectId:"math",date:new Date("2026-10-01"),testType:"MANUAL",title:"SEED_QA",source:"QA",ratingScore:140,belowThreshold:false,partial:false,countsTowardAverage:true,comment:""}});
 expect((await deleteExamResult("seed-qa-hardening")).ok).toBe(false);
 expect(await prisma.examResult.findUnique({where:{id:"seed-qa-hardening"}})).not.toBeNull();
 expect((await deleteExamResult("seed-qa-hardening",true)).ok).toBe(true);
 expect(await prisma.examResult.findUnique({where:{id:"seed-qa-hardening"}})).toBeNull();
 expect((await deleteExamResult("seed-qa-hardening",true)).ok).toBe(false);
});
it("B cannot complete or move A's calendar task",async()=>{auth.id="learner-b";expect((await setTaskStatus(taskId,"DONE")).ok).toBe(false);expect((await moveTask(taskId,"2026-10-19")).ok).toBe(false);expect((await prisma.studyTask.findUniqueOrThrow({where:{id:taskId}})).status).toBe("PLANNED");});
it("B cannot answer A's card or change A's mistake",async()=>{auth.id="learner-b";const log=vi.spyOn(console,"error").mockImplementation(()=>{});try{expect((await reviewFlashcard("private-card","good")).ok).toBe(false);expect((await setMistakeMeta("private-mistake","OTHER","FIXED")).ok).toBe(false);}finally{log.mockRestore();}expect((await prisma.flashcard.findUniqueOrThrow({where:{id:"private-card"}})).reps).toBe(0);expect((await prisma.mistake.findUniqueOrThrow({where:{id:"private-mistake"}})).status).toBe("OPEN");});
it("B reads own priorities instead of the owner's default settings",async()=>{auth.id="learner-b";expect((await subjectPriorities()).math).toBe(17);expect((await getSettings()).userId).toBe(auth.id);});
it("targeted revalidation covers task, card, result and role changes",async()=>{
 auth.id="learner-a";vi.mocked(revalidatePath).mockClear();expect((await setTaskStatus(taskId,"DONE")).ok).toBe(true);expect(revalidatePath).toHaveBeenCalledWith("/calendar");expect(revalidatePath).toHaveBeenCalledWith("/");expect(revalidatePath).not.toHaveBeenCalledWith("/","layout");
 vi.mocked(revalidatePath).mockClear();expect((await reviewFlashcard("private-card","good")).ok).toBe(true);expect(revalidatePath).toHaveBeenCalledWith("/review");
 vi.mocked(revalidatePath).mockClear();expect((await saveExamResult({...exam,id:resultId})).ok).toBe(true);expect(revalidatePath).toHaveBeenCalledWith("/results");expect(revalidatePath).toHaveBeenCalledWith("/analytics");
 auth.id="owner";vi.mocked(revalidatePath).mockClear();expect((await updateUserRole("learner-b","EDITOR")).ok).toBe(true);expect(revalidatePath).toHaveBeenCalledWith("/admin/users");await prisma.user.update({where:{id:"learner-b"},data:{role:"STUDENT"}});
});
it("Prisma JSON backup and restore preserve records with WAL enabled",async()=>{auth.id="owner";expect(await prisma.$queryRawUnsafe("PRAGMA journal_mode")).toEqual([{journal_mode:"wal"}]);const snapshot=await buildBackup();await prisma.examResult.create({data:{userId:"owner",subjectId:"math",date:new Date("2026-10-19"),testType:"MANUAL",title:"QA restore extra",source:"QA",ratingScore:150,belowThreshold:false,partial:false,countsTowardAverage:true,comment:""}});expect((await restoreBackup(JSON.stringify(snapshot),"ВІДНОВИТИ")).ok).toBe(true);expect(await prisma.examResult.count()).toBe(snapshot.examResults.length);expect(await prisma.user.count()).toBe(snapshot.users.length);expect(await prisma.testAttempt.count()).toBe(snapshot.attempts.length);expect(await prisma.$queryRawUnsafe("PRAGMA integrity_check")).toEqual([{integrity_check:"ok"}]);expect(await prisma.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);});
