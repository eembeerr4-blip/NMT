import {saveTestSet,setTestPublication,cloneTestSet,startPublishedTestSet} from "@/server/test-sets";
import {afterAll,afterEach,beforeAll,expect,it,vi} from "vitest";
import {execFileSync} from "node:child_process";
import {existsSync,unlinkSync,rmdirSync,writeFileSync} from "node:fs";
import path from "node:path";
const auth=vi.hoisted(()=>({id:"A"}));
vi.mock("@/lib/prisma",async()=>{
 const {PrismaClient}=await import("@prisma/client");const {mkdtempSync}=await import("node:fs");const {tmpdir}=await import("node:os");const path=await import("node:path");
 const folder=mkdtempSync(path.join(tmpdir(),"nmt-reliability-"));const database=path.join(folder,"qa.db");
 return {prisma:new PrismaClient({datasourceUrl:"file:"+database.replaceAll("\\","/")}),folder,database};
});
vi.mock("@/server/session",()=>({getSessionUser:()=>prisma.user.findUnique({where:{id:auth.id},include:{subjects:true}}),createSession:vi.fn(),clearSession:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/headers",()=>({headers:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn(),notFound:()=>{throw Error("NOT_FOUND");},useRouter:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {initializeSQLite} from "@/lib/sqlite-init";
import {DEFAULT_FORMAT,DEFAULT_SCHEDULE,SUBJECTS} from "@/lib/constants";
import {dateKey,addDateKeys} from "@/lib/dates";
import {gradeAnswer} from "@/lib/grade";
import {finishAttempt,saveLearningTime,saveDraft,changeElective,recalculateFuturePlan,moveTask,saveQuestion,completeLesson,saveVideoPosition,createCustomTask} from "@/server/actions";
import {syncPlanWithClient} from "@/server/sync";

async function counts(){return {answers:await prisma.answer.count(),mistakes:await prisma.mistake.count(),progress:await prisma.userTopicProgress.count(),reviews:await prisma.reviewSchedule.count(),sessions:await prisma.studySession.count(),xp:await prisma.xpEvent.count()};}
it("C04: sync never silently shifts overdue custom or personally moved tasks",async()=>{
 const past=addDateKeys(dateKey(),-1);
 await prisma.studyTask.createMany({data:[
  {id:"QA-past-custom",userId:"A",dateKey:past,title:"QA-own date",kind:"custom",durationMin:10,templateKey:"custom-QA-past"},
  {id:"QA-past-moved",userId:"A",dateKey:past,title:"QA-own move",kind:"study",durationMin:10,templateKey:"moved-QA-past",movedFromId:"QA-past-original"}
 ]});
 const before=await prisma.studyTask.findMany({where:{id:{in:["QA-past-custom","QA-past-moved"]}},orderBy:{id:"asc"}});
 await syncPlanWithClient("A",prisma);await syncPlanWithClient("A",prisma);
 const after=await prisma.studyTask.findMany({where:{id:{in:["QA-past-custom","QA-past-moved"]}},orderBy:{id:"asc"}});
 expect(after).toEqual(before);
});
it("A10: invalid dates and kinds never write tasks or move an existing task",async()=>{
 const before=await prisma.studyTask.count();
 for(const date of ["2026-02-31","2026-13-01","2026-01-01bad"]){
  expect((await createCustomTask({dateKey:date,title:"QA-invalid",durationMin:10})).ok).toBe(false);
 }
 expect((await createCustomTask({dateKey:"2026-10-19",title:"QA-invalid-kind",durationMin:10,kind:"SQL"})).ok).toBe(false);
 expect(await prisma.studyTask.count()).toBe(before);
 await prisma.studyTask.create({data:{id:"QA-date-task",userId:"A",dateKey:"2026-10-19",title:"QA-original",kind:"custom",durationMin:10}});
 expect((await moveTask("QA-date-task","2026-02-31")).ok).toBe(false);
 expect((await prisma.studyTask.findUniqueOrThrow({where:{id:"QA-date-task"}})).dateKey).toBe("2026-10-19");
});
it("A15: student playback cannot change shared video duration; positions are bounded and private",async()=>{
 await prisma.videoLesson.create({data:{id:"QA-playback",topicId:"topic",title:"QA-playback",url:"https://example.invalid/video",youtubeId:"QA-video",durationSec:null}});
 expect((await saveVideoPosition("QA-playback",12.9,100)).ok).toBe(true);
 expect((await prisma.videoLesson.findUniqueOrThrow({where:{id:"QA-playback"}})).durationSec).toBeNull();
 expect((await prisma.userVideoProgress.findUniqueOrThrow({where:{userId_videoId:{userId:"A",videoId:"QA-playback"}}})).lastPositionSec).toBe(12);
 expect((await saveVideoPosition("QA-playback",1000000,1000000)).ok).toBe(true);
 expect((await prisma.userVideoProgress.findUniqueOrThrow({where:{userId_videoId:{userId:"A",videoId:"QA-playback"}}})).lastPositionSec).toBe(86400);
 await prisma.videoLesson.update({where:{id:"QA-playback"},data:{durationSec:80}});
 auth.id="B";expect((await saveVideoPosition("QA-playback",90)).ok).toBe(true);
 expect((await prisma.userVideoProgress.findUniqueOrThrow({where:{userId_videoId:{userId:"B",videoId:"QA-playback"}}})).lastPositionSec).toBe(80);
 expect((await prisma.userVideoProgress.findUniqueOrThrow({where:{userId_videoId:{userId:"A",videoId:"QA-playback"}}})).lastPositionSec).toBe(86400);
 for(const value of [-1,NaN,Infinity])expect((await saveVideoPosition("QA-playback",value)).ok).toBe(false);
});
beforeAll(async()=>{
 const {database}=await import("@/lib/prisma") as unknown as {database:string};writeFileSync(database,"");
 execFileSync(process.execPath,[path.join(process.cwd(),"node_modules/prisma/build/index.js"),"migrate","deploy"],{env:{...process.env,DATABASE_URL:"file:"+database.replaceAll("\\","/")},stdio:"pipe",timeout:60000});await initializeSQLite(prisma);
 await prisma.subject.createMany({data:SUBJECTS.map((s,i)=>({id:s.id,name:s.name,shortName:s.shortName,description:s.description,color:s.color,sortOrder:i}))});
 for(const id of ["A","B","staff"]){
  await prisma.user.create({data:{id,nickname:id,firstName:id,onboarded:true,role:id==="staff"?"EDITOR":"STUDENT"}});
  await prisma.userSubject.createMany({data:["math","ukrainian","history","biology"].map(subjectId=>({userId:id,subjectId,active:true,role:subjectId==="biology"?"ELECTIVE":"REQUIRED"}))});
  await prisma.userSettings.create({data:{id,userId:id,scheduleJson:JSON.stringify(DEFAULT_SCHEDULE),formatJson:JSON.stringify(DEFAULT_FORMAT)}});
 }
 await prisma.topic.create({data:{id:"topic",subjectId:"math",title:"QA",sortOrder:0}});
 for(let i=1;i<=3;i++)await prisma.question.create({data:{id:"q"+i,subjectId:"math",topicId:"topic",type:"NUMERIC",difficulty:"EASY",prompt:"2 + 2",correctAnswer:"4",explanation:"2+2=4",verificationStatus:"VERIFIED"}});
 await prisma.test.create({data:{id:"test",subjectId:"math",topicId:"topic",title:"QA",kind:"TOPIC",questions:{create:[1,2,3].map((n,i)=>({questionId:"q"+n,sortOrder:i}))}}});
},60000);
afterEach(async()=>{await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS qa_answer_failure");await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS qa_elective_failure");await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS qa_achievement_failure");auth.id="A";vi.restoreAllMocks();});
afterAll(async()=>{await prisma.$disconnect();const {folder,database}=await import("@/lib/prisma") as unknown as {folder:string;database:string};for(const suffix of ["","-wal","-shm"]){if(existsSync(database+suffix))unlinkSync(database+suffix);}rmdirSync(folder);});

it("rolls back ALL finish writes when the second answer fails; a retry succeeds exactly once",async()=>{
 await prisma.testAttempt.create({data:{id:"fault",testId:"test",userId:"A"}});const before=await counts();
 await prisma.$executeRawUnsafe("CREATE TRIGGER qa_answer_failure BEFORE INSERT ON Answer WHEN NEW.attemptId='fault' AND NEW.questionId='q2' BEGIN SELECT RAISE(ABORT,'QA controlled failure'); END");
 vi.spyOn(console,"error").mockImplementation(()=>{});
 expect((await finishAttempt("fault",{q1:"99",q2:"4",q3:"4"})).ok).toBe(false);
 expect(await counts()).toEqual(before);expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:"fault"}})).status).toBe("IN_PROGRESS");
 await prisma.$executeRawUnsafe("DROP TRIGGER qa_answer_failure");expect((await finishAttempt("fault",{q1:"99",q2:"4",q3:"4"})).ok).toBe(true);
 const after=await counts();expect(after.answers-before.answers).toBe(3);expect(after.sessions-before.sessions).toBe(1);expect(after.xp-before.xp).toBe(1);
 expect((await finishAttempt("fault",{q1:"0"})).ok).toBe(true);expect(await counts()).toEqual(after);
 expect((await saveDraft("fault",{q1:"stale"},0)).ok).toBe(false);expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:"fault"}})).draftJson).toContain('"99"');
});
it("concurrent finish calls cannot duplicate answers, progress, sessions or XP",async()=>{
 await prisma.testAttempt.create({data:{id:"race",testId:"test",userId:"A"}});const before=await counts();
 const result=await Promise.all([finishAttempt("race",{q1:"4",q2:"4",q3:"4"}),finishAttempt("race",{q1:"4",q2:"4",q3:"4"})]);
 expect(result.every(r=>r.ok)).toBe(true);const after=await counts();expect(after.answers-before.answers).toBe(3);expect(after.sessions-before.sessions).toBe(1);expect(after.xp-before.xp).toBe(1);
 expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:"race"}})).correctCount).toBe(3);
},40000);
it("B cannot claim, finish or save A's attempt and no data changes",async()=>{
 await prisma.testAttempt.create({data:{id:"owned",testId:"test",userId:"A"}});auth.id="B";const before=await counts();
 expect((await finishAttempt("owned",{q1:"4"})).ok).toBe(false);expect((await saveDraft("owned",{q1:"4"},0)).ok).toBe(false);expect(await counts()).toEqual(before);expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:"owned"}})).status).toBe("IN_PROGRESS");
});
it("rolls back task cancellation, elective membership AND schedule on a midway failure",async()=>{
 const when=addDateKeys(dateKey(),2);await prisma.studyTask.create({data:{id:"old-elective",userId:"A",subjectId:"biology",dateKey:when,title:"Keep on rollback",kind:"study",durationMin:10}});
 const before={subjects:await prisma.userSubject.findMany({where:{userId:"A"},orderBy:{id:"asc"}}),settings:await prisma.userSettings.findUnique({where:{userId:"A"}}),task:await prisma.studyTask.findUnique({where:{id:"old-elective"}})};
 await prisma.$executeRawUnsafe("CREATE TRIGGER qa_elective_failure BEFORE UPDATE ON UserSettings WHEN NEW.userId='A' BEGIN SELECT RAISE(ABORT,'QA elective failure'); END");vi.spyOn(console,"error").mockImplementation(()=>{});
 expect((await changeElective("geography",true)).ok).toBe(false);
 expect(await prisma.userSubject.findMany({where:{userId:"A"},orderBy:{id:"asc"}})).toEqual(before.subjects);expect(await prisma.userSettings.findUnique({where:{userId:"A"}})).toEqual(before.settings);expect(await prisma.studyTask.findUnique({where:{id:"old-elective"}})).toEqual(before.task);
});
it("serializes elective changes and retains exactly one elective and all DONE history",async()=>{
 await prisma.studyTask.create({data:{id:"done-biology",userId:"A",subjectId:"biology",dateKey:dateKey(),title:"Done",kind:"study",status:"DONE",durationMin:10}});
 expect((await changeElective("geography",false)).ok).toBe(false);expect((await changeElective("geography",true)).ok).toBe(true);
 const results=await Promise.all([changeElective("chemistry",true),changeElective("physics",true)]);expect(results.every(r=>r.ok)).toBe(true);
 expect(await prisma.userSubject.count({where:{userId:"A",role:"ELECTIVE",active:true}})).toBe(1);expect((await prisma.studyTask.findUniqueOrThrow({where:{id:"done-biology"}})).status).toBe("DONE");
},40000);
it("custom/moved/DONE tasks survive sync, reduced study days and explicit recalculation",async()=>{
 const when=addDateKeys(dateKey(),3);
 for(const [id,templateKey,status] of [["custom","custom-fixture","PLANNED"],["done","d1-s99","DONE"]])await prisma.studyTask.create({data:{id,userId:"A",subjectId:"math",dateKey:when,title:id,templateKey,status,kind:"custom",durationMin:10}});
 expect((await moveTask("custom",addDateKeys(when,1))).ok).toBe(true);
 const moved=await prisma.studyTask.findFirstOrThrow({where:{movedFromId:"custom"}});
 await prisma.userSettings.update({where:{userId:"A"},data:{studyDaysJson:"[]"}});await syncPlanWithClient("A");expect((await recalculateFuturePlan()).ok).toBe(true);
 expect((await prisma.studyTask.findUniqueOrThrow({where:{id:moved.id}})).status).toBe("PLANNED");expect((await prisma.studyTask.findUniqueOrThrow({where:{id:"done"}})).status).toBe("DONE");expect((await prisma.studyTask.findUniqueOrThrow({where:{id:"custom"}})).status).toBe("MOVED");
});
it("an acknowledged theory-only lesson can finish, but empty content or missing acknowledgement cannot",async()=>{
 const lessonJson=JSON.stringify({objectives:[],theory:"Теоретичний матеріал",examples:[],rules:[],mistakes:[],summary:""});
 await prisma.topic.create({data:{id:"theory",subjectId:"math",title:"Theory",sortOrder:1,lessonJson}});await prisma.topic.create({data:{id:"empty",subjectId:"math",title:"Empty",sortOrder:2}});
 expect((await completeLesson("theory",false)).ok).toBe(false);expect((await completeLesson("empty",true)).ok).toBe(false);expect((await completeLesson("theory",true)).ok).toBe(true);
 expect(await prisma.studySession.count({where:{userId:"A",topicId:"theory"}})).toBe(1);expect(await prisma.reviewSchedule.count({where:{userId:"A",topicId:"theory"}})).toBe(1);
 expect((await prisma.userTopicProgress.findUniqueOrThrow({where:{userId_topicId:{userId:"A",topicId:"theory"}}})).status).toBe("IN_PROGRESS");
});
for(const type of ["SINGLE_CHOICE","MATCHING","SEQUENCE","NUMERIC"]){
 it(`round-trips text-only edits for ${type} without losing option ids or grading`,async()=>{
  auth.id="staff";const base={subjectId:"math",topicId:"topic",type,difficulty:"EASY",prompt:"QA original prompt",explanation:"QA explanation",source:"QA",verificationStatus:"VERIFIED"};
  const options=type==="NUMERIC"?[]:type==="MATCHING"?[{label:"1",text:"one",matchKey:"left"},{label:"А",text:"1",matchKey:"right"}]:[{label:"А",text:"one"},{label:"Б",text:"two"}];
  const answer=type==="NUMERIC"?"4":type==="MATCHING"?'{"1":"А"}':type==="SEQUENCE"?'["Б","А"]':"А";
  const created=await saveQuestion({...base,options,correctAnswer:answer});expect(created.ok).toBe(true);if(!created.ok || !created.id)throw Error("Missing question");
  const old=await prisma.question.findUniqueOrThrow({where:{id:created.id},include:{options:{orderBy:{sortOrder:"asc"}}}});
  expect((await saveQuestion({...base,id:old.id,prompt:"QA edited prompt",correctAnswer:old.correctAnswer,options:old.options})).ok).toBe(true);
  const updated=await prisma.question.findUniqueOrThrow({where:{id:old.id},include:{options:{orderBy:{sortOrder:"asc"}}}});expect(updated.options.map(o=>o.id)).toEqual(old.options.map(o=>o.id));expect(updated.correctAnswer).toBe(old.correctAnswer);
  const userAnswer=type==="MATCHING"||type==="SEQUENCE"?JSON.parse(updated.correctAnswer):updated.correctAnswer;expect(gradeAnswer({...updated,userAnswer}).isCorrect).toBe(true);
 });
}
it("students cannot edit shared questions; used questions remain immutable",async()=>{
 const used=await prisma.question.findUniqueOrThrow({where:{id:"q1"},include:{options:true}});auth.id="A";expect((await saveQuestion({...used,prompt:"Forbidden edit"})).ok).toBe(false);
 auth.id="staff";expect((await saveQuestion({...used,prompt:"Used edit"})).ok).toBe(false);expect((await prisma.question.findUniqueOrThrow({where:{id:"q1"}})).prompt).toBe(used.prompt);
});
it("rolls back even a late achievement failure after the result, mastery, task and XP were written",async()=>{
 await prisma.achievement.create({data:{id:"first-test",title:"QA first test",description:"QA",xp:5}});
 await prisma.testAttempt.create({data:{id:"late-fault",testId:"test",userId:"A"}});
 await prisma.studyTask.create({data:{id:"late-task",topicId:"topic",userId:"A",dateKey:dateKey(),title:"QA pending",kind:"study",durationMin:10}});
 const before=await counts();const progress=await prisma.userTopicProgress.findMany({where:{userId:"A"}});const tasks=await prisma.studyTask.findMany({where:{userId:"A"},orderBy:{id:"asc"}});const reviews=await prisma.reviewSchedule.findMany({where:{userId:"A"},orderBy:{id:"asc"}});
 await prisma.$executeRawUnsafe("CREATE TRIGGER qa_achievement_failure BEFORE INSERT ON Achievement WHEN NEW.userId='A' BEGIN SELECT RAISE(ABORT,'QA late failure'); END");vi.spyOn(console,"error").mockImplementation(()=>{});
 expect((await finishAttempt("late-fault",{q1:"4",q2:"4",q3:"4"})).ok).toBe(false);expect(await counts()).toEqual(before);expect(await prisma.userTopicProgress.findMany({where:{userId:"A"}})).toEqual(progress);expect(await prisma.studyTask.findMany({where:{userId:"A"},orderBy:{id:"asc"}})).toEqual(tasks);expect(await prisma.reviewSchedule.findMany({where:{userId:"A"},orderBy:{id:"asc"}})).toEqual(reviews);expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:"late-fault"}})).status).toBe("IN_PROGRESS");
});
it("finishes with intact SQLite constraints",async()=>{expect(await prisma.$queryRawUnsafe("PRAGMA integrity_check")).toEqual([{integrity_check:"ok"}]);expect(await prisma.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);});

it("learning load is private, atomic and preserves personal and DONE tasks",async()=>{
 const future=addDateKeys(dateKey(),2);
 await prisma.studyTask.createMany({data:[{id:"QA-load-custom",userId:"A",dateKey:future,title:"QA-custom",kind:"custom",durationMin:10,templateKey:"custom-QA-load"},{id:"QA-load-done",userId:"A",dateKey:future,title:"QA-done",kind:"study",durationMin:10,status:"DONE",templateKey:"QA-done"}]});
 const preserved=await prisma.studyTask.findMany({where:{id:{in:["QA-load-custom","QA-load-done"]}},orderBy:{id:"asc"}});
 const other=await prisma.userSettings.findUniqueOrThrow({where:{userId:"B"}});
 for(const input of [{dailyMinutes:0,studyDays:[1]},{dailyMinutes:45,studyDays:[]},{dailyMinutes:45,studyDays:[7]}])expect((await saveLearningTime(input)).ok).toBe(false);
 const before=await prisma.userSettings.findUniqueOrThrow({where:{userId:"A"}});
 await prisma.$executeRawUnsafe("CREATE TRIGGER qa_load_fail BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT,'QA load rollback'); END");
 try {vi.spyOn(console,"error").mockImplementation(()=>{});expect((await saveLearningTime({dailyMinutes:45,studyDays:[1,3]})).ok).toBe(false);expect(await prisma.userSettings.findUniqueOrThrow({where:{userId:"A"}})).toEqual(before);}finally{await prisma.$executeRawUnsafe("DROP TRIGGER qa_load_fail");}
 const results=await Promise.all([saveLearningTime({dailyMinutes:45,studyDays:[1,3]}),saveLearningTime({dailyMinutes:60,studyDays:[2,4,2]})]);expect(results.every(result=>result.ok)).toBe(true);
 const settings=await prisma.userSettings.findUniqueOrThrow({where:{userId:"A"}});expect([45,60]).toContain(settings.dailyMinutes);expect(new Set(JSON.parse(settings.studyDaysJson)).size).toBe(2);
 expect(await prisma.userSettings.findUniqueOrThrow({where:{userId:"B"}})).toEqual(other);
 expect(await prisma.studyTask.findMany({where:{id:{in:["QA-load-custom","QA-load-done"]}},orderBy:{id:"asc"}})).toEqual(preserved);
});

it("test sets enforce roles, preserve attempted history, archive safely and roll back failures",async()=>{
 const input={title:"QA-published",subjectId:"math",timeLimitMin:10,questionIds:["q1"]};
 for(const id of ["missing","A","staff"]){auth.id=id;for(const call of [()=>saveTestSet(input),()=>setTestPublication("test","PUBLISHED"),()=>cloneTestSet("test")])expect((await call()).ok).toBe(false);}
 await prisma.user.create({data:{id:"QA-admin",nickname:"QA-admin",firstName:"QA",role:"ADMIN"}});await prisma.userSubject.create({data:{userId:"QA-admin",subjectId:"math",active:true,role:"REQUIRED"}});
 auth.id="QA-admin";const created=await saveTestSet(input);expect(created.ok).toBe(true);if(!created.ok||!created.id)throw Error("QA setup failed");const id=created.id;
 await prisma.test.update({where:{id},data:{configJson:JSON.stringify({grading:"QA-preserve",publication:"DRAFT"})}});
 await prisma.$executeRawUnsafe("CREATE TRIGGER QA_publication_fail BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT,'QA publication rollback'); END");
 try {vi.spyOn(console,"error").mockImplementation(()=>{});expect((await setTestPublication(id,"PUBLISHED")).ok).toBe(false);expect(JSON.parse((await prisma.test.findUniqueOrThrow({where:{id}})).configJson).publication).toBe("DRAFT");}finally{await prisma.$executeRawUnsafe("DROP TRIGGER QA_publication_fail");}
 expect((await setTestPublication(id,"PUBLISHED")).ok).toBe(true);expect(JSON.parse((await prisma.test.findUniqueOrThrow({where:{id}})).configJson).grading).toBe("QA-preserve");
 auth.id="A";const attempt=await startPublishedTestSet(id);expect(attempt.ok).toBe(true);if(!attempt.ok||!attempt.id)throw Error("QA attempt failed");expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:attempt.id}})).userId).toBe("A");
 auth.id="QA-admin";expect((await saveTestSet({...input,id,title:"QA-forbidden history edit"})).ok).toBe(false);expect((await prisma.test.findUniqueOrThrow({where:{id}})).title).toBe("QA-published");
 const clone=await cloneTestSet(id);expect(clone.ok).toBe(true);if(!clone.ok||!clone.id)throw Error("QA clone failed");expect((await prisma.testQuestion.findMany({where:{testId:clone.id}})).map(q=>q.questionId)).toEqual(["q1"]);
 expect((await setTestPublication(id,"ARCHIVED")).ok).toBe(true);auth.id="A";expect((await startPublishedTestSet(id)).ok).toBe(false);expect((await finishAttempt(attempt.id,{q1:"4"})).ok).toBe(true);expect((await prisma.testAttempt.findUniqueOrThrow({where:{id:attempt.id}})).status).toBe("COMPLETED");
 auth.id="QA-admin";expect((await setTestPublication(clone.id,"PUBLISHED")).ok).toBe(true);
 const [edit,start]=await Promise.all([saveTestSet({...input,id:clone.id,title:"QA-race"}),startPublishedTestSet(clone.id)]);expect(edit.ok&&start.ok).toBe(false);
 expect(await prisma.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
});

it("editing an unused test set preserves its existing test kind",async()=>{
 auth.id="QA-admin";const created=await prisma.test.create({data:{title:"QA-kind",kind:"EXAM",subjectId:"math"}});
 expect((await saveTestSet({id:created.id,title:"QA-kind edited",subjectId:"math",timeLimitMin:0,questionIds:["q1"]})).ok).toBe(true);
 expect((await prisma.test.findUniqueOrThrow({where:{id:created.id}})).kind).toBe("EXAM");
});
