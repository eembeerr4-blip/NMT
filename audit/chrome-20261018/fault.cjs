const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient({datasourceUrl:'file:C:/Users/User/nmt-academy/audit/chrome-20261018/qa.db'});
(async()=>{
 if(process.argv[2]==='prepare'){
  await db.test.create({data:{id:'qa-fault-test',subjectId:'math',topicId:'qa-linear',title:'QA контрольований збій таймера',kind:'TOPIC',timeLimitSec:25,questions:{create:[1,2,3].map((n,i)=>({questionId:'qa-q'+n,sortOrder:i}))}}});
  await db.testAttempt.create({data:{id:'qa-fault-timeout-a',testId:'qa-fault-test',userId:'student_a'}});
  await db.$executeRawUnsafe("CREATE TRIGGER qa_controlled_failure BEFORE INSERT ON Answer WHEN NEW.attemptId = 'qa-fault-timeout-a' AND NEW.questionId = 'qa-q2' BEGIN SELECT RAISE(ABORT, 'QA controlled answer failure'); END");
  console.log('QA-only timed attempt and controlled second-answer failure ready');
 }else if(process.argv[2]==='clear'){
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_controlled_failure');console.log('QA trigger removed');
 }else{console.log(JSON.stringify({attempt:await db.testAttempt.findUnique({where:{id:'qa-fault-timeout-a'},select:{status:true,finishedAt:true,draftJson:true}}),answers:await db.answer.findMany({where:{attemptId:'qa-fault-timeout-a'},select:{questionId:true,userAnswer:true}})},null,2));}
})().finally(()=>db.$disconnect());
