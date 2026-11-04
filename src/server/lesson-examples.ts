"use server";

import { prisma } from "@/lib/prisma";
import { parseLesson } from "@/lib/lesson";
import { canEditContent } from "@/lib/permissions";
import { lessonAccess } from "@/lib/readiness";
import { checkExampleAnswer } from "@/lib/example-answer";
import { assertLearningAccess, getSessionUser } from "./session";

async function accessibleExample(topicId:string,index:number,task:string) {
  const user=await getSessionUser();
  if(!user)throw new Error("Потрібен вхід до профілю.");
  assertLearningAccess(user);
  if(!Number.isInteger(index)||index<0||index>=20||typeof task!=="string"||task.length>3000)throw new Error("Приклад недоступний.");
  const topic=await prisma.topic.findUnique({where:{id:topicId},select:{coverage:true,lessonJson:true}});
  if(!topic||(!canEditContent(user)&&!lessonAccess(topic).available))throw new Error("Матеріал недоступний.");
  const example=parseLesson(topic.lessonJson)?.examples[index];
  if(!example||example.task!==task)throw new Error("Приклад змінився. Оновіть сторінку.");
  return example;
}

export async function checkLessonExample(topicId:string,index:number,task:string,answer:string) {
  try {
    const example=await accessibleExample(topicId,index,task);
    if(typeof answer!=="string"||!answer.trim()||answer.length>200||!example.answerCheck)return {ok:false as const,error:"Автоматична перевірка недоступна для цієї відповіді."};
    return {ok:true as const,correct:checkExampleAnswer(answer,example.answerCheck)};
  }catch {return {ok:false as const,error:"Приклад недоступний або змінився. Оновіть сторінку та перевірте доступ."};}
}

export async function revealLessonExample(topicId:string,index:number,task:string) {
  try {return {ok:true as const,solution:(await accessibleExample(topicId,index,task)).solution};}
  catch {return {ok:false as const,error:"Розв’язання недоступне або приклад змінився. Оновіть сторінку."};}
}
