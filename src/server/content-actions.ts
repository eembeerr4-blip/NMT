"use server";
import {userFacingError} from "@/lib/errors";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {canEditContent} from "@/lib/permissions";
import {auditedWrite} from "@/server/audit-log";
import {getSessionUser} from "@/server/session";
import type {ActionState} from "@/server/actions";
const subjectSchema=z.object({id:z.string().min(1),name:z.string().trim().min(2,"Вкажіть назву предмета.").max(120),shortName:z.string().trim().min(2,"Вкажіть коротку назву.").max(60),description:z.string().trim().max(2000,"Опис надто довгий.")});
export async function saveSubjectDetails(input:unknown):Promise<ActionState>{
 const user=await getSessionUser();if(!user||!canEditContent(user))return {ok:false,error:"Редагування предметів доступне лише редактору, адміністратору або власнику."};
 const parsed=subjectSchema.safeParse(input);if(!parsed.success)return {ok:false,error:parsed.error.issues[0]?.message??"Перевірте поля форми."};
 const {id,...data}=parsed.data;
 try{return await auditedWrite<ActionState>(user,{action:"SUBJECT_UPDATED",entityType:"subject",entityId:id},async tx=>{await tx.subject.update({where:{id},data});revalidatePath("/","layout");return {ok:true};});}
 catch(error){return {ok:false,error:userFacingError(error)};}
}
