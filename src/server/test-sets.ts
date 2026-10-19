"use server";
import type {Prisma} from "@prisma/client";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {UserError,userFacingError} from "@/lib/errors";
import {isAdministrator} from "@/lib/permissions";
import {publicationConfig,testPublication,type Publication} from "@/lib/test-publication";
import {getSessionUser} from "./session";
import {recordAudit} from "./audit-log";
import type {ActionState} from "./actions";

async function actor(admin=false) {const user=await getSessionUser();if(!user)throw new UserError("Потрібен вхід до профілю.");if(admin&&!isAdministrator(user))throw new UserError("Керування наборами доступне адміністратору.");return user;}
async function lock(tx:Prisma.TransactionClient,id:string) {await tx.$executeRaw`UPDATE "Test" SET "configJson"="configJson" WHERE "id"=${id}`;return tx.test.findUniqueOrThrow({where:{id},include:{questions:{orderBy:{sortOrder:"asc"},include:{question:true}},_count:{select:{attempts:true}}}});}
function refresh(){revalidatePath("/admin/tests");revalidatePath("/admin/tests/[id]","page");revalidatePath("/tests");}
export async function saveTestSet(input:{id?:string;title:string;subjectId:string;timeLimitMin:number;questionIds:string[]}):Promise<ActionState> {
 try {
  const user=await actor(true);
  if(!input||typeof input.title!=="string"||!input.title.trim()||input.title.length>160||!Number.isInteger(input.timeLimitMin)||input.timeLimitMin<0||input.timeLimitMin>240||!Array.isArray(input.questionIds)||!input.questionIds.length||input.questionIds.length>200||input.questionIds.some(id=>typeof id!=="string"))throw new UserError("Перевірте назву, час і склад набору (1–200 запитань).");
  const ids=[...new Set(input.questionIds)];
  const id=await prisma.$transaction(async tx=>{
   const existing=input.id?await lock(tx,input.id):null;
   if(existing?._count.attempts)throw new UserError("Набір уже має спроби. Створіть нову версію, щоб зберегти історію.");
   const questions=await tx.question.findMany({where:{id:{in:ids},subjectId:input.subjectId,verificationStatus:"VERIFIED"}});
   if(questions.length!==ids.length)throw new UserError("Оберіть лише перевірені запитання одного предмета.");
   const topicId=questions.every(q=>q.topicId===questions[0].topicId)?questions[0].topicId:null;
   const data={title:input.title.trim(),subjectId:input.subjectId,topicId,kind:"TOPIC",timeLimitSec:input.timeLimitMin?input.timeLimitMin*60:null,configJson:publicationConfig(existing?.configJson??"{}","DRAFT")};
   const set=existing?await tx.test.update({where:{id:existing.id},data}):await tx.test.create({data});
   if(existing)await tx.testQuestion.deleteMany({where:{testId:set.id}});
   await tx.testQuestion.createMany({data:ids.map((questionId,sortOrder)=>({testId:set.id,questionId,sortOrder}))});
   await recordAudit(user,{action:"TEST_SET_SAVED",entityType:"test",entityId:set.id,metadata:{count:ids.length}},tx);return set.id;
  },{maxWait:15000,timeout:20000});refresh();return {ok:true,id,message:"Набір збережено як чернетку."};
 }catch(error){return {ok:false,error:userFacingError(error)};}
}
export async function setTestPublication(id:string,state:Publication):Promise<ActionState> {
 try {const user=await actor(true);if(!["DRAFT","PUBLISHED","ARCHIVED"].includes(state))throw new UserError("Оберіть стан публікації.");
  await prisma.$transaction(async tx=>{const set=await lock(tx,id);if(state==="PUBLISHED"&&(!set.questions.length||set.questions.some(q=>q.question.verificationStatus!=="VERIFIED")))throw new UserError("Публікація потребує перевірених запитань.");await tx.test.update({where:{id},data:{configJson:publicationConfig(set.configJson,state)}});await recordAudit(user,{action:"TEST_PUBLICATION_CHANGED",entityType:"test",entityId:id,metadata:{fields:["status"]}},tx);},{maxWait:15000,timeout:20000});refresh();return {ok:true,message:"Стан набору оновлено."};
 }catch(error){return {ok:false,error:userFacingError(error)};}
}
export async function cloneTestSet(id:string):Promise<ActionState> {
 try {const user=await actor(true);const created=await prisma.$transaction(async tx=>{const set=await lock(tx,id);const copy=await tx.test.create({data:{title:`${set.title.slice(0,140)} — нова версія`,subjectId:set.subjectId,topicId:set.topicId,kind:set.kind,timeLimitSec:set.timeLimitSec,configJson:publicationConfig(set.configJson,"DRAFT"),questions:{create:set.questions.map(q=>({questionId:q.questionId,sortOrder:q.sortOrder}))}}});await recordAudit(user,{action:"TEST_SET_SAVED",entityType:"test",entityId:copy.id,metadata:{count:set.questions.length}},tx);return copy;});refresh();return {ok:true,id:created.id,message:"Створено окрему чернетку. Історію оригіналу збережено."};
 }catch(error){return {ok:false,error:userFacingError(error)};}
}
export async function startPublishedTestSet(id:string):Promise<ActionState> {
 try {const user=await actor();const attempt=await prisma.$transaction(async tx=>{const set=await lock(tx,id);if(testPublication(set.configJson)!=="PUBLISHED"||!set.questions.length||set.questions.some(q=>q.question.verificationStatus!=="VERIFIED")||!set.subjectId||!user.subjects.some(subject=>subject.active&&subject.subjectId===set.subjectId))throw new UserError("Цей набір зараз недоступний. Оберіть інший тест.");return tx.testAttempt.create({data:{testId:id,userId:user.id}});},{maxWait:15000,timeout:20000});return {ok:true,id:attempt.id};
 }catch(error){return {ok:false,error:userFacingError(error)};}
}
