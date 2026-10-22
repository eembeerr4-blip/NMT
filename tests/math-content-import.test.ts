import {beforeAll,afterAll,expect,it} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadMathContent} from '../src/lib/math-content';
import {applyMathContent} from '../prisma/upgrade-math-content';
const dir=mkdtempSync(path.join(tmpdir(),'nmt-math-import-'));const file=path.join(dir,'qa.db');const url='file:'+file.replaceAll('\\','/');const db=new PrismaClient({datasources:{db:{url}}});const content=loadMathContent();
beforeAll(async()=>{
 writeFileSync(file,'');execFileSync(process.execPath,[path.join(process.cwd(),'node_modules/prisma/build/index.js'),'migrate','deploy'],{env:{...process.env,DATABASE_URL:url},stdio:'pipe',timeout:60000});
 for(const id of ['math','other'])await db.subject.create({data:{id,name:id,shortName:id,description:'QA',color:'#000000',sortOrder:0}});
 for(const id of [...content.protectedTopicIds,...content.packs.map(p=>p.topicId),'other-topic'])await db.topic.create({data:{id,subjectId:id==='other-topic'?'other':'math',title:id,sortOrder:0,lessonJson:'{}'}});
 await db.question.create({data:{id:'old-math',subjectId:'math',topicId:content.packs[0].topicId,type:'NUMERIC',difficulty:'EASY',prompt:'2+2',correctAnswer:'4',explanation:'existing',verificationStatus:'VERIFIED'}});
 await db.question.create({data:{id:'old-other',subjectId:'other',topicId:'other-topic',type:'NUMERIC',difficulty:'EASY',prompt:'2+3',correctAnswer:'5',explanation:'existing',verificationStatus:'VERIFIED'}});
 await db.user.create({data:{id:'qa-person',nickname:'qa-person',firstName:'QA'}});await db.examResult.create({data:{userId:'qa-person',subjectId:'math',date:new Date('2026-10-01'),testType:'MANUAL',title:'Keep',source:'QA',ratingScore:150,belowThreshold:false,partial:false,countsTowardAverage:true,comment:''}});
},60000);
afterAll(async()=>{await db.$disconnect();rmSync(dir,{recursive:true});});
it('imports only incomplete mathematics, preserves existing data and is idempotent',async()=>{
 const old=await db.question.findMany({orderBy:{id:'asc'}});const protectedTopics=await db.topic.findMany({where:{id:{in:content.protectedTopicIds}},orderBy:{id:'asc'}});const personal=await db.examResult.findMany();
 const first=await applyMathContent(db,content);expect(first).toMatchObject({created:120,lessonsUpdated:10,preserved:{oldQuestions:true,otherSubjects:true,protectedTopics:true,personalData:true}});
 expect(await db.question.findMany({where:{id:{in:old.map(q=>q.id)}},orderBy:{id:'asc'}})).toEqual(old);expect(await db.topic.findMany({where:{id:{in:content.protectedTopicIds}},orderBy:{id:'asc'}})).toEqual(protectedTopics);expect(await db.examResult.findMany()).toEqual(personal);expect(await db.flashcard.count()).toBe(0);expect(await db.question.count({where:{verificationStatus:'DRAFT'}})).toBe(120);
 expect(await applyMathContent(db,content)).toMatchObject({created:0,lessonsUpdated:0,skipped:120});expect(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([]);
},20000);
it('rejects an existing complete lesson without changing any records',async()=>{
 const topicId=content.packs[0].topicId;await db.question.updateMany({where:{topicId,verificationStatus:'DRAFT'},data:{verificationStatus:'VERIFIED'}});const before=await db.topic.findUnique({where:{id:topicId}});
 await expect(applyMathContent(db,content)).rejects.toThrow(/already complete lesson/);expect(await db.topic.findUnique({where:{id:topicId}})).toEqual(before);expect(await db.question.count()).toBe(122);
});
