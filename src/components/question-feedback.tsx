"use client";
import {reportQuestion} from "@/server/actions";
import {useActionFeedback} from "./use-action-feedback";

export function QuestionFeedback({id}:{id:string}) {
 const {pending,result,run}=useActionFeedback();
 return <form className="question-feedback space-y-2" onSubmit={async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const issue=String(new FormData(form).get('issue')||'');
  await run(()=>reportQuestion(id,issue),()=>form.reset());
 }}>
  <div className="flex flex-wrap gap-2"><input name="issue" required maxLength={1000} aria-label="Опис помилки в завданні" placeholder="Повідомити про помилку в завданні" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-2 text-sm"/><button disabled={pending} className="text-sm underline" type="submit">{pending?'Надсилання…':'Надіслати'}</button></div>
  {result?<p role={result.ok?"status":"alert"} className="text-sm">{result.ok?result.message||'Передано редактору.':result.error}</p>:null}
 </form>;
}
