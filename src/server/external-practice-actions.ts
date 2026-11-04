"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { practiceScheduleSchema, type ExternalResultInput } from "@/lib/external-practice";
import { UserError, userFacingError } from "@/lib/errors";
import { externalPracticeReady, syncExternalPractice, saveExternalResultFor, changeExternalTaskFor, practiceTransaction } from "./external-practice";

function refresh() { for(const path of ["/exams","/calendar","/results","/analytics"]) revalidatePath(path); }
export async function savePracticeSchedule(raw:unknown) {
  try {
    const user=await requireUser();
    const config=practiceScheduleSchema.parse(raw);
    if(!await externalPracticeReady()) throw new UserError("Потрібна погоджена міграція зовнішньої практики. Робочу базу автоматично не змінюємо.");
    await practiceTransaction(prisma,async tx=>{
      await tx.$executeRaw`UPDATE UserSettings SET id=id WHERE userId=${user.id}`;
      const settings=await tx.userSettings.findUniqueOrThrow({where:{userId:user.id}});
      const studyDays:number[]=JSON.parse(settings.studyDaysJson);
      if(config.enabled && (config.days.some(d=>!studyDays.includes(d)) || config.durationMin>settings.dailyMinutes)) throw new UserError("Дні тренувань мають бути навчальними, тривалість — у межах денного ліміту. Спершу змініть навчальні дні в налаштуваннях.");
      const schedule=JSON.parse(settings.scheduleJson);
      await tx.userSettings.update({where:{id:settings.id},data:{scheduleJson:JSON.stringify({...schedule,externalPractice:config})}});
      await syncExternalPractice(user.id,tx);
    });
    refresh();return {ok:true as const};
  } catch(error) { return {ok:false as const,error:userFacingError(error)}; }
}
export async function saveExternalResult(raw:ExternalResultInput) {
  try {const user=await requireUser();await saveExternalResultFor(user.id,raw);refresh();return {ok:true as const};}
  catch(error){return {ok:false as const,error:userFacingError(error)};}
}
export async function changeExternalTask(id:string,operation:"skip"|"move",nextDate?:string) {
  try {const user=await requireUser();if(!["skip","move"].includes(operation))throw new UserError("Некоректна дія.");await changeExternalTaskFor(user.id,id,operation,nextDate);refresh();return {ok:true as const};}
  catch(error){return {ok:false as const,error:userFacingError(error)};}
}
