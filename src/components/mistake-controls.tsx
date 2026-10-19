"use client";
import {useRouter} from "next/navigation";
import {setMistakeMeta} from "@/server/actions";
import {Button} from "./ui";
import {useActionFeedback} from "./use-action-feedback";
export function MistakeControls({id,category,status}:{id:string;category:string;status:string}) {
 const {pending,result,run}=useActionFeedback();const router=useRouter();
 return <form className="space-y-2" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);await run(()=>setMistakeMeta(id,category,String(data.get("status"))),()=>router.refresh());}}>
  <div className="flex flex-wrap gap-2"><select name="status" aria-label="Стан помилки" defaultValue={status} disabled={pending} className="h-10 rounded-xl border border-border bg-card px-2 text-sm"><option value="OPEN">До повторення</option><option value="REVIEWING">Повторюю</option><option value="FIXED">Виправлено</option></select><Button type="submit" size="sm" disabled={pending}>{pending?"Збереження…":"Зберегти стан"}</Button></div>
  {result?<p role={result.ok?"status":"alert"} className="text-sm">{result.ok?"Стан збережено.":result.error}</p>:null}
 </form>;
}
