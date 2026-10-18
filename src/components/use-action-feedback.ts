"use client";

import {useRef,useState} from "react";
import type {ActionState} from "@/server/actions";

/** Adds client feedback without changing the server ActionState contract. */
export function useActionFeedback() {
  const lock=useRef(false);
  const [pending,setPending]=useState(false);
  const [result,setResult]=useState<ActionState>();
  async function run(action:()=>Promise<ActionState>,onSuccess?:()=>void) {
    if(lock.current)return;
    lock.current=true;setPending(true);setResult(undefined);
    try {
      const response=await action();setResult(response);
      if(response.ok)onSuccess?.();
      return response;
    } catch {
      const response:ActionState={ok:false,error:"Не вдалося виконати дію. Перевірте з’єднання та повторіть."};
      setResult(response);return response;
    } finally {lock.current=false;setPending(false);}
  }
  return {pending,result,run};
}
