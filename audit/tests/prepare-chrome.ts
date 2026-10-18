import {PrismaClient} from '@prisma/client';
import {hashPassword} from '../../src/lib/auth';
import {SUBJECTS,DEFAULT_SCHEDULE,DEFAULT_FORMAT} from '../../src/lib/constants';
const url='file:D:/Вайб-кодинг/nmt-reliability/audit/tests/chrome.db';
if(process.env.DATABASE_URL!==url)throw Error('QA database only');
const db=new PrismaClient();
async function main(){
 if(await db.user.count())throw Error('Fresh QA database required');
 await db.subject.createMany({data:SUBJECTS.map((s,i)=>({id:s.id,name:s.name,shortName:s.shortName,color:s.color,description:s.description,sortOrder:i}))});
 for(const [id,role] of [['owner','OWNER'],['qa_admin','ADMIN'],['qa_editor','EDITOR'],['student_a','STUDENT'],['student_b','STUDENT']]){
  await db.user.create({data:{id,role,nickname:id,firstName:id,onboarded:true,diagnosticSkipped:true,passwordHash:hashPassword('Nmt-Ui-QA-Only-2026')}});
  await db.userSubject.createMany({data:['math','ukrainian','history','biology'].map(subjectId=>({userId:id,subjectId,active:true,role:subjectId==='biology'?'ELECTIVE':'REQUIRED'}))});
  await db.userSettings.create({data:{id:id==='owner'?'default':id,userId:id,scheduleJson:JSON.stringify(DEFAULT_SCHEDULE),formatJson:JSON.stringify(DEFAULT_FORMAT)}});
 }
 const lesson={objectives:['Розв’язати рівняння'],prerequisites:[],theory:'Виконуйте однакові дії з обома частинами рівняння.',rules:['Зберігайте рівність'],examples:[{task:'x + 2 = 5',solution:'x = 3'}],mistakes:['Зміна лише однієї частини'],summary:'Перевірте відповідь підстановкою',sources:[]};
 for(const [id,title] of [['qa-linear','QA Лінійні рівняння'],['qa-empty','QA Урок без питань']])await db.topic.create({data:{id,subjectId:'math',title,sortOrder:id==='qa-linear'?0:1,summary:'Disposable QA fixture',lessonJson:JSON.stringify(lesson)}});
 for(let i=1;i<=3;i++)await db.question.create({data:{id:'qa-q'+i,subjectId:'math',topicId:'qa-linear',type:'NUMERIC',difficulty:'EASY',prompt:`Знайдіть x: x + ${i} = ${i+3}`,correctAnswer:'3',explanation:'Віднімаємо однакове число з обох частин.',verificationStatus:'VERIFIED'}});
 for(const type of ['SINGLE_CHOICE','MATCHING','SEQUENCE','NUMERIC']){
  const id='qa-unused-'+type;const opts=type==='NUMERIC'?[]:type==='MATCHING'?[{id:id+'l',label:'1',text:'Один',matchKey:'left',sortOrder:0},{id:id+'r',label:'А',text:'1',matchKey:'right',sortOrder:1}]:[{id:id+'a',label:'А',text:'Перший',sortOrder:0},{id:id+'b',label:'Б',text:'Другий',sortOrder:1}];
  const correctAnswer=type==='NUMERIC'?'3':type==='MATCHING'?JSON.stringify({[id+'l']:id+'r'}):type==='SEQUENCE'?JSON.stringify([id+'a',id+'b']):id+'a';
  await db.question.create({data:{id,subjectId:'math',topicId:'qa-linear',type,difficulty:'EASY',prompt:'QA unused '+type,explanation:'QA explanation',correctAnswer,verificationStatus:'VERIFIED',options:{create:opts}}});
 }
 await db.test.create({data:{id:'qa-test',subjectId:'math',topicId:'qa-linear',title:'QA Тест 3 питання',kind:'TOPIC',questions:{create:[1,2,3].map((n,i)=>({questionId:'qa-q'+n,sortOrder:i}))}}});
 await db.testAttempt.create({data:{id:'qa-attempt-a',testId:'qa-test',userId:'student_a'}});
 await db.videoLesson.create({data:{id:'qa-video',topicId:'qa-linear',youtubeId:'qa_no_external_video',url:'https://www.youtube.com/watch?v=qa_no_external_video',title:'QA null duration',durationSec:null}});
 await db.note.create({data:{id:'qa-note-a',userId:'student_a',title:'A PRIVATE SENTINEL',content:'Only student A',topicId:'qa-linear'}});
 await db.examResult.create({data:{id:'qa-result-a',userId:'student_a',subjectId:'math',date:new Date(),testType:'QA',title:'A PRIVATE RESULT',ratingScore:150,countsTowardAverage:true}});
 await db.studyTask.create({data:{id:'qa-task-a',userId:'student_a',subjectId:'math',topicId:'qa-linear',dateKey:'2026-10-18',title:'QA custom task A',kind:'CUSTOM',durationMin:15}});
 await db.flashcard.create({data:{id:'qa-card-a',userId:'student_a',subjectId:'math',topicId:'qa-linear',kind:'QA',front:'A private card',back:'Only A',dueKey:'2026-10-17'}});
 await db.reviewSchedule.create({data:{id:'qa-review-a',userId:'student_a',topicId:'qa-linear',dueKey:'2026-10-17',intervalDays:1}});
 console.log('QA fixtures ready: 5 profiles + ANON. No working data copied.');
}
main().finally(()=>db.$disconnect());
