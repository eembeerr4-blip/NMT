"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveLessonContent } from "@/server/actions";
import { publishLesson } from "@/server/content-import";
import type { LessonContent } from "@/lib/lesson";
import { Button, Input, Textarea } from "./ui";

export function LessonEditor({topicId,lesson}:{topicId:string;lesson:LessonContent|null}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [examples,setExamples]=useState(()=>Array.from({length:Math.min(20,Math.max(4,lesson?.examples.length??0)+1)},(_,i)=>{
    const example=lesson?.examples[i],check=example?.answerCheck;
    return {key:i,task:example?.task??"",solution:example?.solution??"",checkType:check?.type??"none",value:check?.type==="numeric"?String(check.value):"",variable:check?.type==="numeric"?check.variable??"":""};
  }));
  const changeExample=(index:number,values:Partial<(typeof examples)[number]>)=>setExamples(rows=>rows.map((row,i)=>i===index?{...row,...values}:row));
  const moveExample=(index:number,direction:number)=>setExamples(rows=>{const next=[...rows];[next[index],next[index+direction]]=[next[index+direction],next[index]];return next;});
  const sourceSlots=Array.from({length:Math.max(3,lesson?.sources?.length??0)+1},(_,i)=>i);
  const lines=(value:FormDataEntryValue|null)=>String(value||"").split("\n").map(v=>v.trim()).filter(Boolean);
  return <details className="rounded-xl border border-border p-4">
    <summary className="cursor-pointer font-medium">Редагувати матеріал уроку</summary>
    <form className="mt-4 space-y-3" onSubmit={async event=>{
      event.preventDefault();setBusy(true);
      const form=new FormData(event.currentTarget);
      try {
        const storedExamples=examples.filter(v=>v.task.trim()||v.solution.trim()).map(row=>{
          let answerCheck=null;
          if(row.checkType==="numeric") {
            const raw=row.value.trim().replace(",",".").replace(/−/g,"-");
            if(!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)||!Number.isFinite(Number(raw)))throw new Error("Вкажіть числовий еталон без одиниць вимірювання.");
            const variable=row.variable.trim();
            if(variable&&!/^[a-z]$/i.test(variable))throw new Error("Змінна має бути однією латинською літерою.");
            answerCheck={type:"numeric" as const,value:Number(raw),...(variable?{variable}:{})};
          }else if(row.checkType==="no-solution")answerCheck={type:"no-solution" as const};
          return {task:row.task.trim(),solution:row.solution.trim(),answerCheck};
        });
        const sources=sourceSlots.map(i=>({title:String(form.get("sourceTitle"+i)||"").trim(),url:String(form.get("sourceUrl"+i)||"").trim()})).filter(v=>v.title||v.url);
        const result=await saveLessonContent(topicId,{objectives:lines(form.get("objectives")),prerequisites:lines(form.get("prerequisites")),theory:String(form.get("theory")||""),rules:lines(form.get("rules")),examples:storedExamples,mistakes:lines(form.get("mistakes")),summary:String(form.get("summary")||""),notes:String(form.get("notes")||""),sources});
        setMessage(result.ok?"Матеріал збережено. Готовність перераховано.":result.error);
      }catch(error){setMessage(error instanceof Error?error.message:"Не вдалося зберегти матеріал.");}finally{setBusy(false)}
    }}>
      <label className="block text-sm">Цілі, по одній на рядок<Textarea name="objectives" defaultValue={lesson?.objectives.join("\n")} /></label>
      <label className="block text-sm">Що знати перед початком<Textarea name="prerequisites" defaultValue={lesson?.prerequisites?.join("\n")} /></label>
      <label className="block text-sm">Пояснення з нуля<Textarea name="theory" defaultValue={lesson?.theory} required className="min-h-64" /></label>
      <label className="block text-sm">Правила, по одному на рядок<Textarea name="rules" defaultValue={lesson?.rules.join("\n")} /></label>
      {examples.map((example,i)=><fieldset className="space-y-2 rounded-xl border border-border p-3" key={example.key}><legend className="text-sm">Приклад {i+1}</legend>
        <Input aria-label={"Умова прикладу "+(i+1)} value={example.task} onChange={event=>changeExample(i,{task:event.target.value,checkType:"none",value:"",variable:""})} placeholder="Умова"/>
        <Textarea aria-label={"Розв’язання прикладу "+(i+1)} value={example.solution} onChange={event=>changeExample(i,{solution:event.target.value,checkType:"none",value:"",variable:""})} placeholder="Покрокове розв’язання"/>
        <label className="block text-sm">Перевірка відповіді<select className="mt-1 min-h-10 w-full rounded-lg border border-border bg-card px-2" aria-label={"Тип еталона прикладу "+(i+1)} value={example.checkType} onChange={event=>changeExample(i,{checkType:event.target.value as typeof example.checkType})}><option value="none">Без автоматичної перевірки</option><option value="numeric">Числова відповідь</option><option value="no-solution">Розв’язків немає</option></select></label>
        {example.checkType==="numeric"?<div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Числовий еталон<Input aria-label={"Числовий еталон прикладу "+(i+1)} inputMode="decimal" value={example.value} onChange={event=>changeExample(i,{value:event.target.value})}/></label><label className="text-sm">Змінна (необов’язково)<Input aria-label={"Змінна прикладу "+(i+1)} maxLength={1} value={example.variable} onChange={event=>changeExample(i,{variable:event.target.value})}/></label></div>:null}
        <p className="text-xs text-muted-foreground">Після зміни умови чи розв’язання еталон потрібно перевірити й вибрати повторно. Дроби вводьте десятковим числом; вирази та інші типи не перевіряються автоматично.</p>
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={i===0} onClick={()=>moveExample(i,-1)}>Приклад {i+1} вгору</Button><Button type="button" size="sm" variant="outline" disabled={i===examples.length-1} onClick={()=>moveExample(i,1)}>Приклад {i+1} вниз</Button></div>
      </fieldset>)}

      <label className="block text-sm">Типові помилки, по одній на рядок<Textarea name="mistakes" defaultValue={lesson?.mistakes.join("\n")} /></label>
      <label className="block text-sm">Коротка пам’ятка<Textarea name="summary" defaultValue={lesson?.summary}/></label>
      <label className="block text-sm">Додаткові примітки<Textarea name="notes" defaultValue={lesson?.notes}/></label>
      {sourceSlots.map(i=><fieldset className="space-y-2" key={i}><legend className="text-sm">Джерело {i+1}</legend><Input name={"sourceTitle"+i} aria-label={"Назва джерела "+(i+1)} defaultValue={lesson?.sources?.[i]?.title} placeholder="Назва"/><Input name={"sourceUrl"+i} aria-label={"Посилання джерела "+(i+1)} defaultValue={lesson?.sources?.[i]?.url} placeholder="https://..." type="url"/></fieldset>)}
      <Button disabled={busy} type="submit">{busy?"Збереження…":"Зберегти матеріал"}</Button>
      {message?<p role="status" className="text-sm">{message}</p>:null}
    </form>
  </details>;
}

export function PublishLessonButton({ topicId, coverage }: { topicId: string; coverage: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (coverage === "READY" || coverage === "VERIFIED") return <p className="text-sm text-muted-foreground">Урок опубліковано для учнів. Завдання з’являються в практиці лише після окремої перевірки.</p>;
  return <div className="space-y-2">
    <Button type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const result = await publishLesson(topicId);
        setMessage(result.ok ? result.message ?? "Урок опубліковано." : result.error);
        if (result.ok) router.refresh();
      } finally { setBusy(false); }
    }}>{busy ? "Публікація…" : "Опублікувати для учнів"}</Button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}
