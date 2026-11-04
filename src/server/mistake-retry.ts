import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { gradeAnswer } from '@/lib/grade';
import { answerCompletion } from '@/lib/answer-completion';
import { learnerQuestionAvailable } from '@/lib/test-access';
import { lessonAccess } from '@/lib/readiness';
import { dateKey, addDateKeys } from '@/lib/dates';
import { UserError } from '@/lib/errors';

type Db = Prisma.TransactionClient;
const unavailable = 'Помилка або завдання зараз недоступні.';
export const retryTypes = ['SINGLE_CHOICE','NUMERIC','MATCHING','SEQUENCE','SHORT_TEXT'];
export async function ownedRetryQuestion(db: Db, userId: string, mistakeId: string) {
  const mistake = await db.mistake.findFirst({where:{id:mistakeId,userId},include:{question:{include:{topic:true,options:{orderBy:{sortOrder:'asc'}}}}}});
  if(!mistake?.question || !learnerQuestionAvailable(mistake.question) || mistake.topicId!==mistake.question.topicId || mistake.subjectId!==mistake.question.subjectId) throw new UserError(unavailable);
  return mistake;
}
export function publicRetryQuestion(question: NonNullable<Awaited<ReturnType<typeof ownedRetryQuestion>>['question']>) {
  const {id,type,prompt,difficulty,options,updatedAt}=question;
  const publicOptions=options.map(({id,label,text,matchKey,sortOrder})=>({id,label,text,matchKey,sortOrder}));
  const revision=createHash('sha256').update(JSON.stringify([id,type,prompt,publicOptions,updatedAt])).digest('hex');
  return {question:{id,type,prompt,difficulty,options:publicOptions},revision};
}
export async function ensureNextReview(db: Db,userId:string,topicId:string,days:number,priority:number) {
  const dueKey=addDateKeys(dateKey(),days);
  const existing=await db.reviewSchedule.findFirst({where:{userId,topicId,dueKey,status:'PENDING'}});
  if(!existing)await db.reviewSchedule.create({data:{userId,topicId,dueKey,intervalDays:days,priority,status:'PENDING'}});
  else if(existing.priority<priority)await db.reviewSchedule.update({where:{id:existing.id},data:{priority}});
}
export function nextReviewInterval(previous:number) {return previous<7?7:previous<30?30:previous;}
export async function completeScheduledReview(prisma:PrismaClient,userId:string,id:string) {
  return prisma.$transaction(async db=>{
    const row=await db.reviewSchedule.findFirst({where:{id,userId},include:{topic:true}});
    if(!row || !lessonAccess(row.topic).available)throw new UserError('Повторення недоступне.');
    if(row.status==='DONE')return;
    if(row.status!=='PENDING'||row.dueKey>dateKey())throw new UserError('Час цього повторення ще не настав.');
    const changed=await db.reviewSchedule.updateMany({where:{id,userId,status:'PENDING'},data:{status:'DONE',completedAt:new Date()}});
    if(changed.count&&!await db.reviewSchedule.findFirst({where:{userId,topicId:row.topicId,status:'PENDING',dueKey:{gt:dateKey()}}}))await ensureNextReview(db,userId,row.topicId,nextReviewInterval(row.intervalDays),row.priority);
  });
}
export async function retryMistake(prisma:PrismaClient,userId:string,input:{mistakeId:string;requestId:string;revision:string;answer:unknown}) {
  const answerJson=JSON.stringify(input.answer);
  if(!answerJson || answerJson.length>10000)throw new UserError('Відповідь завелика або порожня.');
  const execute=async(db:Db)=>{
    const mistake=await ownedRetryQuestion(db,userId,input.mistakeId);
    const question=mistake.question!;
    if(publicRetryQuestion(question).revision!==input.revision)throw new UserError('Завдання змінилося. Оновіть сторінку.');
    if(!retryTypes.includes(question.type))throw new UserError('Автоматична перевірка цього типу недоступна.');
    if(answerCompletion(question,input.answer)!=='complete')throw new UserError('Заповніть відповідь повністю.');
    const existing=await db.mistakeRetry.findUnique({where:{id:input.requestId}});
    if(existing){
      if(existing.mistakeId!==mistake.id||existing.answerJson!==answerJson)throw new UserError('Цей запит вже використано.');
      return {isCorrect:existing.isCorrect,explanation:question.explanation};
    }
    const grade=gradeAnswer({type:question.type,correctAnswer:question.correctAnswer,userAnswer:input.answer});
    await db.mistakeRetry.create({data:{id:input.requestId,mistakeId:mistake.id,answerJson,isCorrect:grade.isCorrect}});
    await db.mistake.update({where:{id:mistake.id,userId},data:{status:grade.isCorrect===true?'FIXED':grade.isCorrect===false?'OPEN':'REVIEWING',...(grade.isCorrect===false?{repeatCount:{increment:1}}:{})}});
    const topicId=question.topicId!;
    if(grade.isCorrect===false)await db.userTopicProgress.upsert({where:{userId_topicId:{userId,topicId}},create:{userId,topicId,status:'NEEDS_REVIEW'},update:{status:'NEEDS_REVIEW'}});
    const due=await db.reviewSchedule.findMany({where:{userId,topicId,status:'PENDING',dueKey:{lte:dateKey()}}});
    const stillOpen=await db.mistake.count({where:{userId,topicId,status:{not:'FIXED'}}});
    if(grade.isCorrect!==null){
      if(!stillOpen || grade.isCorrect===false)await db.reviewSchedule.updateMany({where:{userId,topicId,status:'PENDING',dueKey:{lte:dateKey()}},data:{status:'DONE',completedAt:new Date()}});
      const days=grade.isCorrect&&!stillOpen&&due.length?nextReviewInterval(Math.max(...due.map(r=>r.intervalDays))):1;
      const next=await db.reviewSchedule.findFirst({where:{userId,topicId,status:'PENDING',dueKey:{gt:dateKey()}}});
      if(!grade.isCorrect||stillOpen||!next)await ensureNextReview(db,userId,topicId,days,grade.isCorrect&&!stillOpen?0:3);
    }else await ensureNextReview(db,userId,topicId,1,3);
    return {isCorrect:grade.isCorrect,explanation:question.explanation};
  };
  try{return await prisma.$transaction(execute);}
  catch(error){
    // A simultaneous duplicate request may have won the unique ID reservation.
    if(error && typeof error==='object' && 'code' in error && error.code==='P2002'){
      const mistake=await ownedRetryQuestion(prisma,userId,input.mistakeId);
      const row=await prisma.mistakeRetry.findUnique({where:{id:input.requestId}});
      if(row?.mistakeId===mistake.id&&row.answerJson===answerJson&&publicRetryQuestion(mistake.question!).revision===input.revision)return {isCorrect:row.isCorrect,explanation:mistake.question!.explanation};
    }
    throw error;
  }
}

export async function mistakeRetryReady(db:Db) {
 const rows=await db.$queryRawUnsafe<{name:string}[]>("SELECT name FROM sqlite_master WHERE type='table' AND name='MistakeRetry'");
 return rows.length===1;
}
