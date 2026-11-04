import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const auth=vi.hoisted(()=>({user:{id:'A',role:'STUDENT',accountStatus:'APPROVED',onboarded:true} as {id:string;role:string;accountStatus:string;onboarded:boolean}|null}));
vi.mock('@/lib/prisma',async()=>{
 const {PrismaClient}=await import('@prisma/client');
 const dir=path.join(process.cwd(),'stage5-qa');mkdirSync(dir,{recursive:true});const folder=mkdtempSync(path.join(dir,'retry-tests-'));const database=path.join(folder,'qa.db');
 return {prisma:new PrismaClient({datasourceUrl:'file:'+database.replaceAll('\\','/')+'?connection_limit=1'}),database};
});
vi.mock('@/server/session',()=>({getSessionUser:()=>auth.user,createSession:vi.fn(),clearSession:vi.fn(),assertLearningAccess:(user:{accountStatus:string})=>{if(user.accountStatus!=='APPROVED')throw Error('PENDING');}}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));vi.mock('next/headers',()=>({headers:vi.fn()}));vi.mock('next/navigation',()=>({redirect:vi.fn()}));
import {prisma} from '@/lib/prisma';
import {ownedRetryQuestion,publicRetryQuestion,completeScheduledReview} from './mistake-retry';
import {submitMistakeRetry} from './mistake-retry-actions';
import {buildBackup,restoreBackup,completeReview,reviewFlashcard,setMistakeMeta} from './actions';
import {dateKey,addDateKeys} from '@/lib/dates';
const today=()=>dateKey();
const lesson=JSON.stringify({objectives:[],theory:'Theory',examples:[{task:'Example',solution:'Original solution',answerCheck:{type:'numeric',value:25}}]});
async function input(answer:unknown='5',requestId=randomUUID()) {return {mistakeId:'M',requestId,revision:publicRetryQuestion((await ownedRetryQuestion(prisma,'A','M')).question!).revision,answer};}
async function snapshot(){const names=['Test','TestAttempt','Answer','StudyTask','ExamResult','VideoLesson','Topic'];return Promise.all(names.map(table=>prisma.$queryRawUnsafe('SELECT * FROM "'+table+'" ORDER BY rowid')));}
async function counts(){return {history:await prisma.mistakeRetry.count(),reviews:await prisma.reviewSchedule.count(),progress:await prisma.userTopicProgress.count()};}
beforeAll(async()=>{
 const {database}=await import('@/lib/prisma') as unknown as {database:string};writeFileSync(database,'',{flag:'wx'});
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:'file:'+database.replaceAll('\\','/')},stdio:'pipe'});
 await prisma.subject.create({data:{id:'math',name:'Math',shortName:'M',description:'QA',color:'#000',sortOrder:0}});
 for(const id of ['A','B','owner'])await prisma.user.create({data:{id,nickname:id,firstName:'Synthetic',passwordHash:'unused-qa-hash',onboarded:true,accountStatus:'APPROVED'}});
},60000);
beforeEach(async()=>{
 auth.user={id:'A',role:'STUDENT',accountStatus:'APPROVED',onboarded:true};
 await prisma.mistakeRetry.deleteMany();await prisma.mistake.deleteMany();await prisma.reviewSchedule.deleteMany();await prisma.userTopicProgress.deleteMany();await prisma.flashcard.deleteMany();await prisma.test.deleteMany();await prisma.videoLesson.deleteMany();await prisma.question.deleteMany();await prisma.topic.deleteMany();
 await prisma.topic.create({data:{id:'T',subjectId:'math',title:'QA',sortOrder:0,coverage:'READY',lessonJson:lesson}});
 await prisma.question.create({data:{id:'Q',topicId:'T',subjectId:'math',type:'NUMERIC',difficulty:'EASY',prompt:'Fresh question',correctAnswer:'5',explanation:'PRIVATE EXPLANATION',verificationStatus:'VERIFIED'}});
 await prisma.mistake.create({data:{id:'M',userId:'A',subjectId:'math',topicId:'T',questionId:'Q',prompt:'Historical prompt',userAnswer:'old answer',correctAnswer:'old key',explanation:'old explanation'}});
});
afterAll(()=>prisma.$disconnect());
it('correct retry fixes only the mistake, records history and schedules without fake attempts or mastery',async()=>{
 const before=await snapshot();expect(await submitMistakeRetry(await input())).toMatchObject({ok:true,isCorrect:true,explanation:'PRIVATE EXPLANATION'});
 expect(await prisma.mistake.findUnique({where:{id:'M'}})).toMatchObject({status:'FIXED',prompt:'Historical prompt',userAnswer:'old answer',correctAnswer:'old key',explanation:'old explanation',repeatCount:1});
 expect(await counts()).toEqual({history:1,reviews:1,progress:0});expect(await snapshot()).toEqual(before);
});
it('incorrect retry preserves history and schedules tomorrow with priority; does not count as fixed',async()=>{
 expect(await submitMistakeRetry(await input('6'))).toMatchObject({ok:true,isCorrect:false});
 expect(await prisma.mistake.findUnique({where:{id:'M'}})).toMatchObject({status:'OPEN',repeatCount:2});
 expect(await prisma.reviewSchedule.findFirst()).toMatchObject({intervalDays:1,dueKey:addDateKeys(today(),1),priority:3});
 expect(await prisma.userTopicProgress.findFirst()).toMatchObject({status:'NEEDS_REVIEW'});
});
it('same request and concurrent duplicates apply only once',async()=>{
 const payload=await input('6');const result=await Promise.all([submitMistakeRetry(payload),submitMistakeRetry(payload)]);expect(result.every(r=>r.ok)).toBe(true);expect(await submitMistakeRetry(payload)).toMatchObject({ok:true,isCorrect:false});expect(await counts()).toEqual({history:1,reviews:1,progress:1});expect((await prisma.mistake.findUniqueOrThrow({where:{id:'M'}})).repeatCount).toBe(2);
 expect((await submitMistakeRetry({...payload,answer:'5'})).ok).toBe(false);
});
it('a fresh solution retains both attempts and never duplicates the same future review date',async()=>{
 await submitMistakeRetry(await input('6'));await submitMistakeRetry(await input('5'));expect(await counts()).toEqual({history:2,reviews:1,progress:1});expect((await prisma.mistake.findUniqueOrThrow({where:{id:'M'}})).status).toBe('FIXED');
});
it.each(['DRAFT','UNVERIFIED','DETACHED','MISSING'])('blocks %s before any writes',async state=>{
 const payload=await input();if(state==='DRAFT')await prisma.topic.update({where:{id:'T'},data:{coverage:'DRAFT'}});if(state==='UNVERIFIED')await prisma.question.update({where:{id:'Q'},data:{verificationStatus:'DRAFT'}});if(state==='DETACHED')await prisma.question.update({where:{id:'Q'},data:{topicId:null}});if(state==='MISSING')await prisma.mistake.delete({where:{id:'M'}});
 const before=await counts();expect((await submitMistakeRetry(payload)).ok).toBe(false);expect(await counts()).toEqual(before);
});
it('rejects foreign, anonymous, pending, stale and invalid requests',async()=>{
 const payload=await input();const before=await counts();auth.user!.id='B';expect((await submitMistakeRetry(payload)).ok).toBe(false);auth.user=null;expect((await submitMistakeRetry(payload)).ok).toBe(false);auth.user={id:'A',role:'STUDENT',accountStatus:'PENDING',onboarded:true};expect((await submitMistakeRetry(payload)).ok).toBe(false);auth.user.accountStatus='APPROVED';expect((await submitMistakeRetry({...payload,revision:'0'.repeat(64)})).ok).toBe(false);expect((await submitMistakeRetry({...payload,requestId:'invalid'})).ok).toBe(false);expect((await submitMistakeRetry({...payload,answer:''})).ok).toBe(false);expect(await counts()).toEqual(before);
});
it.each([
 ['SINGLE_CHOICE','a','a','b'],['NUMERIC','5','5','6'],['SEQUENCE','["a","b","c"]',['a','b','c'],['b','a','c']],['MATCHING','{"a":"b"}',{a:'b'},{a:'c'}],['SHORT_TEXT','вживати заходів|вжити заходів','вжити заходів','неправильно'],
])('uses the existing %s grader',async(type,key,right,wrong)=>{
 await prisma.question.update({where:{id:'Q'},data:{type:type as string,correctAnswer:key as string}});
 await prisma.questionOption.createMany({data:[{id:'a',questionId:'Q',label:'A',text:'Left',sortOrder:0,matchKey:'left'},{id:'b',questionId:'Q',label:'B',text:'Right',sortOrder:1,matchKey:'right'},{id:'c',questionId:'Q',label:'C',text:'Other',sortOrder:2,matchKey:'right'}]});
 expect(await submitMistakeRetry(await input(right))).toMatchObject({ok:true,isCorrect:true});expect(await submitMistakeRetry(await input(wrong))).toMatchObject({ok:true,isCorrect:type==='SHORT_TEXT'?null:false});
});
it('unrecognized SHORT_TEXT stays REVIEWING and unsupported types do not simulate grading',async()=>{
 await prisma.question.update({where:{id:'Q'},data:{type:'SHORT_TEXT',correctAnswer:'known'}});expect(await submitMistakeRetry(await input('unknown'))).toMatchObject({ok:true,isCorrect:null});expect((await prisma.mistake.findUniqueOrThrow({where:{id:'M'}})).status).toBe('REVIEWING');await prisma.question.update({where:{id:'Q'},data:{type:'STEP_BY_STEP'}});expect((await submitMistakeRetry(await input({work:'x',final:'5'}))).ok).toBe(false);expect(await prisma.mistakeRetry.count()).toBe(1);
});
it('public payload omits all keys, explanations and historic answers',async()=>{const value=publicRetryQuestion((await ownedRetryQuestion(prisma,'A','M')).question!);expect(JSON.stringify(value)).not.toMatch(/correctAnswer|PRIVATE EXPLANATION|old key|answerCheck/);});
it.each([1,7,30])('manual overdue review advances %s days idempotently without fixing the mistake',async interval=>{
 await prisma.reviewSchedule.create({data:{id:'R',userId:'A',topicId:'T',dueKey:addDateKeys(today(),-3),intervalDays:interval}});expect((await completeReview('R')).ok).toBe(true);expect((await completeReview('R')).ok).toBe(true);expect(await prisma.reviewSchedule.count()).toBe(2);expect(await prisma.reviewSchedule.findFirst({where:{status:'PENDING'}})).toMatchObject({intervalDays:interval===1?7:30});expect((await prisma.mistake.findUniqueOrThrow({where:{id:'M'}})).status).toBe('OPEN');
});
it('correct retry closes an overdue review and advances interval without deleting it',async()=>{
 await prisma.reviewSchedule.create({data:{id:'R',userId:'A',topicId:'T',dueKey:addDateKeys(today(),-2),intervalDays:1}});await submitMistakeRetry(await input());expect((await prisma.reviewSchedule.findUniqueOrThrow({where:{id:'R'}})).status).toBe('DONE');expect(await prisma.reviewSchedule.findFirst({where:{status:'PENDING'}})).toMatchObject({intervalDays:7});
});
it('manual future, draft and foreign reviews are blocked',async()=>{
 await prisma.reviewSchedule.create({data:{id:'R',userId:'A',topicId:'T',dueKey:addDateKeys(today(),2),intervalDays:1}});expect((await completeReview('R')).ok).toBe(false);await prisma.reviewSchedule.update({where:{id:'R'},data:{dueKey:today()}});auth.user!.id='B';expect((await completeReview('R')).ok).toBe(false);auth.user!.id='A';await prisma.topic.update({where:{id:'T'},data:{coverage:'DRAFT'}});await expect(completeScheduledReview(prisma,'A','R')).rejects.toThrow();expect(await prisma.reviewSchedule.count()).toBe(1);
});
it.each(['again','good'])('flashcard %s preserves its algorithm and prevents replay',async grade=>{
 await prisma.flashcard.create({data:{id:'F',userId:'A',topicId:'T',front:'Front',back:'Back',kind:'term',dueKey:today()}});expect((await reviewFlashcard('F',grade as 'again'|'good')).ok).toBe(true);const card=await prisma.flashcard.findUniqueOrThrow({where:{id:'F'}});expect(card.intervalDays).toBe(grade==='again'?1:3);expect((await reviewFlashcard('F',grade as 'again'|'good')).ok).toBe(false);expect(await prisma.flashcard.findUnique({where:{id:'F'}})).toEqual(card);
});
it('blocks hidden/foreign cards and invalid manual states',async()=>{
 await prisma.flashcard.create({data:{id:'F',userId:'A',topicId:'T',front:'Front',back:'Back',kind:'term',dueKey:today()}});auth.user!.id='B';expect((await reviewFlashcard('F','good')).ok).toBe(false);expect((await setMistakeMeta('M','UNKNOWN_TOPIC','FIXED')).ok).toBe(false);auth.user!.id='A';expect((await setMistakeMeta('M','UNKNOWN_TOPIC','INVALID')).ok).toBe(false);await prisma.topic.update({where:{id:'T'},data:{coverage:'DRAFT'}});expect((await reviewFlashcard('F','good')).ok).toBe(false);expect((await setMistakeMeta('M','UNKNOWN_TOPIC','FIXED')).ok).toBe(false);
});

it('preserves an actual historical attempt and answer byte-for-byte',async()=>{
 await prisma.test.create({data:{id:'H',title:'Historical',kind:'TOPIC',subjectId:'math',topicId:'T',attempts:{create:{id:'HA',userId:'A',status:'COMPLETED',correctCount:0,totalCount:1,percent:0,answers:{create:{questionId:'Q',userAnswer:'old answer',isCorrect:false}}}}}});
 const before=await snapshot();await submitMistakeRetry(await input());expect(await snapshot()).toEqual(before);
});
it('backup roundtrip preserves retry history; a legacy copy cannot silently drop live history',async()=>{
 await submitMistakeRetry(await input());auth.user!.role='OWNER';const backup=await buildBackup();expect(backup.mistakeRetries).toHaveLength(1);const legacy={...backup} as Partial<typeof backup>;delete legacy.mistakeRetries;
 expect((await restoreBackup(JSON.stringify(legacy),'ВІДНОВИТИ')).ok).toBe(false);expect(await prisma.mistakeRetry.count()).toBe(1);
 expect((await restoreBackup(JSON.stringify(backup),'ВІДНОВИТИ')).ok).toBe(true);expect(await prisma.mistakeRetry.findUnique({where:{id:backup.mistakeRetries[0].id}})).toMatchObject({mistakeId:'M',isCorrect:true});
});

it('keeps an existing 1/7/30 chain instead of adding extra intermediate reviews',async()=>{
 await prisma.reviewSchedule.createMany({data:[{id:'r1',userId:'A',topicId:'T',dueKey:today(),intervalDays:1},{id:'r7',userId:'A',topicId:'T',dueKey:addDateKeys(today(),6),intervalDays:7},{id:'r30',userId:'A',topicId:'T',dueKey:addDateKeys(today(),29),intervalDays:30}]});
 await submitMistakeRetry(await input());expect(await prisma.reviewSchedule.count()).toBe(3);expect((await prisma.reviewSchedule.findUniqueOrThrow({where:{id:'r1'}})).status).toBe('DONE');
});
it('manual completion preserves an existing adaptive future chain',async()=>{
 await prisma.reviewSchedule.createMany({data:[{id:'r7',userId:'A',topicId:'T',dueKey:today(),intervalDays:7},{id:'r21',userId:'A',topicId:'T',dueKey:addDateKeys(today(),14),intervalDays:21},{id:'r45',userId:'A',topicId:'T',dueKey:addDateKeys(today(),38),intervalDays:45}]});await completeReview('r7');expect(await prisma.reviewSchedule.count()).toBe(3);expect((await prisma.reviewSchedule.findUniqueOrThrow({where:{id:'r21'}})).status).toBe('PENDING');
});
