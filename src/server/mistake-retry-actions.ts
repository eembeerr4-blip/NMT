'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSessionUser, assertLearningAccess } from './session';
import { retryMistake } from './mistake-retry';
import { userFacingError } from '@/lib/errors';
export async function submitMistakeRetry(raw:unknown) {
  try {
    const user=await getSessionUser();
    if(!user)return {ok:false as const,error:'Потрібен вхід.'};
    assertLearningAccess(user);
    const input=z.object({mistakeId:z.string().min(1).max(200),requestId:z.uuid(),revision:z.string().length(64),answer:z.unknown()}).parse(raw);
    const result=await retryMistake(prisma,user.id,input);
    revalidatePath('/mistakes');revalidatePath('/review');
    return {ok:true as const,...result};
  }catch(error){return {ok:false as const,error:userFacingError(error)};}
}
