"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {deleteQuestion,verifyQuestion} from "@/server/actions";
import {Button} from "./ui";
export function QuestionModeration({id,verified}:{id:string;verified:boolean}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function act(remove:boolean){setBusy(true);try{const result=remove?await deleteQuestion(id):await verifyQuestion(id,"VERIFIED");setMessage(result.ok?result.message??"Збережено.":result.error);if(result.ok)router.refresh();}catch{setMessage("Не вдалося зберегти зміни. Спробуйте ще раз.");}finally{setBusy(false);}}
 return <div className="space-y-2"><div className="flex flex-wrap gap-2">{!verified?<Button variant="outline" disabled={busy} onClick={()=>void act(false)}>Позначити перевіреним</Button>:null}<Button variant="ghost" disabled={busy} onClick={()=>void act(true)}>Прибрати з банку</Button></div>{message?<p role="status" className="text-sm">{message}</p>:null}</div>;
}
