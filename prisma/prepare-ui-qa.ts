import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../src/lib/auth";
import {DEFAULT_FORMAT,DEFAULT_SCHEDULE,SUBJECTS} from "../src/lib/constants";
if(!/^file:\.\/ui-refinement-\d+\.e2e\.db$/.test(process.env.DATABASE_URL??""))throw Error("Only the named isolated UI QA database is allowed");
const db=new PrismaClient();
async function main(){
 if(await db.user.count())throw Error("Fixture database must be empty");
 await db.subject.createMany({data:SUBJECTS.filter(subject=>["math","ukrainian","history","biology"].includes(subject.id)).map((subject,index)=>({id:subject.id,name:subject.name,shortName:subject.shortName,color:subject.color,description:subject.description,sortOrder:index}))});
 for(const [id,role] of [["owner","ADMIN"],["qa-owner","OWNER"],["qa-admin","ADMIN"],["qa-editor","EDITOR"],["qa-student","STUDENT"]]){
  await db.user.create({data:{id,role,nickname:id==="owner"?"qa_root":id.replaceAll("-","_"),firstName:"QA "+role,onboarded:true,passwordHash:hashPassword("Nmt-Ui-QA-Only-2026"),diagnosticSkipped:true}});
  await db.userSubject.createMany({data:["math","ukrainian","history","biology"].map(subjectId=>({userId:id,subjectId,active:true,role:subjectId==="biology"?"ELECTIVE":"REQUIRED"}))});
  await db.userSettings.create({data:{id:id==="owner"?"default":id,userId:id,scheduleJson:JSON.stringify(DEFAULT_SCHEDULE),formatJson:JSON.stringify(DEFAULT_FORMAT)}});
 }
 const lesson={objectives:["Знайти невідоме число"],prerequisites:[],theory:"Лінійне рівняння містить невідоме число в першому степені. Щоб знайти його, виконайте однакові дії з обома частинами рівняння.",rules:["Зберігайте рівність обох частин"],examples:[{task:"x + 2 = 5",solution:"Віднімемо 2: x = 3"},{task:"2x = 8",solution:"Поділимо на 2: x = 4"}],mistakes:["Не змінюйте лише одну частину рівності"],summary:"Перевірте відповідь підстановкою",sources:[]};
 await db.topic.create({data:{id:"qa-linear",sortOrder:0,subjectId:"math",title:"Тестовий урок для перевірки інтерфейсу",summary:"Ізольовані QA-матеріали, яких немає в робочій базі.",lessonJson:JSON.stringify(lesson),estimatedMin:15}});
 for(let i=1;i<=3;i++)await db.question.create({data:{id:"qa-q"+i,subjectId:"math",topicId:"qa-linear",type:"NUMERIC",difficulty:"EASY",prompt:`Знайдіть x: x + ${i} = ${i+3}`,explanation:"Віднімемо однакове число з обох частин: x = 3",correctAnswer:"3",verificationStatus:"VERIFIED",source:"Тільки ізольована QA-перевірка"}});
 await db.test.create({data:{id:"qa-test",subjectId:"math",topicId:"qa-linear",title:"QA: перевірка інтерфейсу тесту",kind:"TOPIC",questions:{create:[1,2,3].map((n,index)=>({questionId:"qa-q"+n,sortOrder:index}))}}});
 await db.testAttempt.create({data:{id:"qa-attempt",testId:"qa-test",userId:"owner"}});
 console.log("Isolated UI fixtures ready: 5 test profiles and one test attempt; working database untouched.");
}main().finally(()=>db.$disconnect());
