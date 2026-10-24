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
  const exampleSlots=Array.from({length:Math.max(4,lesson?.examples.length??0)+1},(_,i)=>i);
  const sourceSlots=Array.from({length:Math.max(3,lesson?.sources?.length??0)+1},(_,i)=>i);
  const lines=(value:FormDataEntryValue|null)=>String(value||"").split("\n").map(v=>v.trim()).filter(Boolean);
  return <details className="rounded-xl border border-border p-4">
    <summary className="cursor-pointer font-medium">Редагувати матеріал уроку</summary>
    <form className="mt-4 space-y-3" onSubmit={async event=>{
      event.preventDefault();setBusy(true);
      const form=new FormData(event.currentTarget);
      try {
        const examples=exampleSlots.map(i=>({task:String(form.get("task"+i)||"").trim(),solution:String(form.get("solution"+i)||"").trim()})).filter(v=>v.task||v.solution);
        const sources=sourceSlots.map(i=>({title:String(form.get("sourceTitle"+i)||"").trim(),url:String(form.get("sourceUrl"+i)||"").trim()})).filter(v=>v.title||v.url);
        const result=await saveLessonContent(topicId,{objectives:lines(form.get("objectives")),prerequisites:lines(form.get("prerequisites")),theory:String(form.get("theory")||""),rules:lines(form.get("rules")),examples,mistakes:lines(form.get("mistakes")),summary:String(form.get("summary")||""),notes:String(form.get("notes")||""),sources});
        setMessage(result.ok?"Матеріал збережено. Готовність перераховано.":result.error);
      }finally{setBusy(false)}
    }}>
      <label className="block text-sm">Цілі, по одній на рядок<Textarea name="objectives" defaultValue={lesson?.objectives.join("\n")} /></label>
      <label className="block text-sm">Що знати перед початком<Textarea name="prerequisites" defaultValue={lesson?.prerequisites?.join("\n")} /></label>
      <label className="block text-sm">Пояснення з нуля<Textarea name="theory" defaultValue={lesson?.theory} required className="min-h-64" /></label>
      <label className="block text-sm">Правила, по одному на рядок<Textarea name="rules" defaultValue={lesson?.rules.join("\n")} /></label>
      {exampleSlots.map(i=><fieldset className="space-y-2 rounded-xl border border-border p-3" key={i}><legend className="text-sm">Приклад {i+1}</legend><Input name={"task"+i} aria-label={"Умова прикладу "+(i+1)} defaultValue={lesson?.examples[i]?.task} placeholder="Умова"/><Textarea name={"solution"+i} aria-label={"Розв’язання прикладу "+(i+1)} defaultValue={lesson?.examples[i]?.solution} placeholder="Покрокове розв’язання"/></fieldset>)}
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
