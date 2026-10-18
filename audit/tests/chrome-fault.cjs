/* eslint-disable @typescript-eslint/no-require-imports */
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient({datasourceUrl:'file:D:/Вайб-кодинг/nmt-reliability/audit/tests/chrome.db'});
(async()=>{
 const size=process.argv[3]||'1440';const attemptId='fix-fault-'+size;
 if(process.argv[2]==='prepare-save'){
  await db.testAttempt.create({data:{id:'fix-save-a',testId:'qa-test',userId:'student_a'}});
  await db.$executeRawUnsafe("CREATE TRIGGER fix_qa_save_failure BEFORE UPDATE OF draftJson ON TestAttempt WHEN NEW.id='fix-save-a' AND NEW.status='IN_PROGRESS' BEGIN SELECT RAISE(ABORT,'QA controlled save failure'); END");
  console.log('QA-only autosave failure ready');
 }else if(process.argv[2]==='prepare'){
  await db.test.create({data:{id:'fix-fault-test-'+size,subjectId:'math',topicId:'qa-linear',title:'FIX timed fault '+size,kind:'TOPIC',timeLimitSec:15,questions:{create:[1,2,3].map((n,i)=>({questionId:'qa-q'+n,sortOrder:i}))}}});
  await db.testAttempt.create({data:{id:attemptId,testId:'fix-fault-test-'+size,userId:'student_a'}});
  await db.$executeRawUnsafe("CREATE TRIGGER IF NOT EXISTS fix_qa_fault BEFORE INSERT ON Answer WHEN NEW.attemptId IN ('fix-fault-1440','fix-fault-390') AND NEW.questionId='qa-q2' BEGIN SELECT RAISE(ABORT,'QA controlled failure'); END");
  console.log('QA-only timed fault fixture ready: '+attemptId);
 }else if(process.argv[2]==='clear'){
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fix_qa_fault');await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS fix_qa_save_failure');console.log('QA triggers removed');
 }else{
  console.log(JSON.stringify({attempt:await db.testAttempt.findUnique({where:{id:attemptId},select:{status:true,finishedAt:true,draftJson:true}}),answers:await db.answer.findMany({where:{attemptId},select:{questionId:true,userAnswer:true}}),tasks:await db.studyTask.findMany({where:{title:'FIX custom survives'},select:{dateKey:true,status:true,templateKey:true,movedFromId:true}}),electives:await db.userSubject.findMany({where:{userId:'student_a',role:'ELECTIVE',active:true},select:{subjectId:true}})},null,2));
 }
})().finally(()=>db.$disconnect());
