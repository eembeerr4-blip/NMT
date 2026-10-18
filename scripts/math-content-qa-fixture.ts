import {PrismaClient} from '@prisma/client';
import {hashPassword} from '../src/lib/auth';
import {loadMathContent} from '../src/lib/math-content';
const url=process.env.DATABASE_URL??'';if(!/^file:C:\/Users\/User\/nmt-academy\/prisma\/math-content-.*\.e2e\.db$/.test(url))throw new Error('Disposable mathematics QA database required');
const db=new PrismaClient({datasources:{db:{url}}});
async function main(){
 await db.user.create({data:{id:'owner',nickname:'mathqa',firstName:'Перевірка математики',role:'OWNER',passwordHash:hashPassword('Math-QA-Only-2026'),onboarded:true,diagnosticSkipped:true}});
 await db.userSettings.update({where:{id:'default'},data:{userId:'owner',timerEnabled:false}});
 await db.userSubject.create({data:{userId:'owner',subjectId:'math',role:'mandatory'}});
 for(const topicId of ['math-expressions','math-trig','math-plane']){
  const pack=loadMathContent().packs.find(p=>p.topicId===topicId)!;
  await db.test.create({data:{id:'qa-'+topicId,subjectId:'math',topicId,title:'[QA DRAFT] '+topicId,kind:'CONTENT_QA',questions:{create:pack.questions.map((q,i)=>({questionId:q.id,sortOrder:i}))},attempts:{create:{id:'qa-attempt-'+topicId,userId:'owner'}}}});
 }
 console.log({fixture:'mathqa',attempts:3,draftStatusUnchanged:await db.question.count({where:{verificationStatus:'DRAFT'}})});
}main().finally(()=>db.$disconnect());
