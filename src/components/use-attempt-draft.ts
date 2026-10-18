"use client";
import {useEffect,useRef,useState} from "react";
import {AttemptDraft,type DraftAnswers,type DraftView} from "@/lib/attempt-draft";
import {saveDraft} from "@/server/actions";

export function useAttemptDraft(userId:string,attemptId:string,server:DraftAnswers,index:number,allowed:string[]) {
  const controller=useRef<AttemptDraft|null>(null);
  const initial=useRef({server,index,allowed});
  const [ready,setReady]=useState(false);
  const [view,setView]=useState<DraftView>({answers:server,index,status:"saved",error:""});
  useEffect(()=>{
    let cancelled=false;
    // Restore after hydration, before enabling inputs. No server/client render mismatch.
    queueMicrotask(()=>{
      if(cancelled)return;
      const storage={getItem:(key:string)=>window.localStorage.getItem(key),setItem:(key:string,value:string)=>window.localStorage.setItem(key,value),removeItem:(key:string)=>window.localStorage.removeItem(key)};
      const draft=new AttemptDraft({key:`attempt:${userId}:${attemptId}`,storage,...initial.current,save:(answers,index)=>saveDraft(attemptId,answers,index),notify:setView});
      controller.current=draft;draft.start();setReady(true);
    });
    const online=()=>{void controller.current?.flush();};
    window.addEventListener("online",online);
    return()=>{cancelled=true;window.removeEventListener("online",online);controller.current?.dispose();controller.current=null;};
  },[userId,attemptId]);
  return {view,ready,controller};
}
