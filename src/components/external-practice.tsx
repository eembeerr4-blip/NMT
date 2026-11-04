"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { SUBJECTS, WEEKDAY_LABELS } from "@/lib/constants";
import { dateKey } from "@/lib/dates";
import { safeZnoUrl, type PracticeSchedule } from "@/lib/external-practice";
import { savePracticeSchedule, saveExternalResult, changeExternalTask } from "@/server/external-practice-actions";

export function PracticeScheduleForm({ config, studyDays, ready }: { config:PracticeSchedule; studyDays:number[]; ready:boolean }) {
  const [pending,start]=useTransition(); const [message,setMessage]=useState(""); const router=useRouter();
  return <Card className="space-y-3 p-4"><h2 className="font-semibold">Дні тренувальних НМТ</h2><p className="text-sm text-muted-foreground">Один пробник у вибраний день, ротація трьох обов’язкових предметів і вибраного четвертого. У кожного предмета своя черга. Пропущений залишається доступним, поки ви не внесете результат або явно не пропустите.</p>
    {!ready?<p role="status">Потрібна окремо погоджена міграція. Зовнішні посилання доступні, запис призначень поки вимкнено.</p>:null}
    <form className="space-y-3" onSubmit={event=>{event.preventDefault();const fd=new FormData(event.currentTarget);start(async()=>{const result=await savePracticeSchedule({enabled:fd.has("enabled"),days:fd.getAll("days").map(Number),durationMin:Number(fd.get("duration"))});setMessage(result.ok?"Розклад збережено. Історію залишено без змін.":result.error);if(result.ok)router.refresh();});}}>
      <label className="flex gap-2"><input type="checkbox" name="enabled" defaultChecked={config.enabled} disabled={!ready}/>Планувати ZNO Online у календарі</label>
      <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-sm">Бажані дні (лише навчальні; змінюються в налаштуваннях)</legend>{WEEKDAY_LABELS.map((label,day)=><label className="flex items-center gap-1 text-sm" key={day}><input type="checkbox" name="days" value={day} defaultChecked={config.days.includes(day)} disabled={!ready||!studyDays.includes(day)}/>{label}{!studyDays.includes(day)?" · відпочинок":""}</label>)}</fieldset>
      <label className="block text-sm">Час на тренування, хв<Input name="duration" type="number" min={20} max={180} defaultValue={config.durationMin} required disabled={!ready}/></label>
      <Button disabled={!ready||pending}>{pending?"Збереження…":"Зберегти дні тренувань"}</Button>
      {message?<p role="status" className="text-sm">{message}</p>:null}
    </form></Card>;
}

export type AssignmentView={id:string;subjectId:string;title:string;variantNumber:number;url:string;questionCount:number;status:string;version:number;date:string;result:null|{date:string;rawScore:number|null;maxRawScore:number|null;ratingScore:number|null;errorCount:number|null;comment:string}};
export function ExternalPracticeCard({ assignment:a }: {assignment:AssignmentView}) {
  const [pending,start]=useTransition();const [message,setMessage]=useState("");const router=useRouter();
  const run=(work:()=>Promise<{ok:boolean;error?:string}>)=>start(async()=>{const r=await work();setMessage(r.ok?"Збережено.":r.error??"Не вдалося зберегти.");if(r.ok)router.refresh();});
  const terminal=a.status==="SKIPPED";const complete=a.status==="COMPLETED";
  return <Card className="min-w-0 space-y-3 p-4" id={`assignment-${a.id}`} data-assignment-id={a.id}>
    <div><h3 className="font-semibold">{SUBJECTS.find(s=>s.id===a.subjectId)?.name} · {a.title}</h3><p className="text-sm text-muted-foreground">{a.date} · {a.questionCount} завдань · ZNO Online · {complete?"Виконано":terminal?"Явно пропущено":a.status==="PAUSED"?"Очікує вільного навчального дня":"Заплановано"}</p></div>
    {safeZnoUrl(a.url)?<Button asChild variant="outline" className="h-auto whitespace-normal text-center"><a href={a.url} target="_blank" rel="noopener noreferrer">Пройти варіант №{a.variantNumber} на ZNO Online</a></Button>:<p role="alert">Посилання не пройшло перевірку безпеки.</p>}
    <p className="text-xs text-muted-foreground">Тестування й пояснення — на зовнішньому сайті. Відкриття посилання не завершує заняття і не змінює номер варіанта.</p>
    {a.result?<p className="text-sm">SELF_REPORTED · внесено самостійно: {a.result.rawScore}/{a.result.maxRawScore??"максимум не вказано"}{a.result.ratingScore!==null?` · рейтинг ${a.result.ratingScore}`:""}. Не є автоматично перевіреним результатом.</p>:null}
    {!terminal?<details><summary className="cursor-pointer font-medium underline">{complete?"Виправити внесений результат":"Я пройшов тест — внести результат"}</summary>
      <form key={`${a.id}:${a.version}`} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const optional=(name:string)=>String(fd.get(name)??"").trim()===""?null:Number(fd.get(name));run(()=>saveExternalResult({assignmentId:a.id,version:a.version,date:String(fd.get("date")),rawScore:Number(fd.get("rawScore")),maxRawScore:optional("maxRawScore"),ratingScore:optional("ratingScore"),errorCount:optional("errorCount"),comment:String(fd.get("comment")??"")}));}}>
        <label className="min-w-0 text-sm">Дата<Input type="date" name="date" defaultValue={a.result?.date??dateKey()} required/></label>
        <label className="min-w-0 text-sm">Тестовий бал<Input type="number" name="rawScore" min={0} max={1000} step={1} defaultValue={a.result?.rawScore??""} required/></label>
        <label className="min-w-0 text-sm">Максимальний тестовий бал (не кількість питань)<Input type="number" name="maxRawScore" min={1} max={1000} step={1} defaultValue={a.result?.maxRawScore??""}/></label>
        <label className="min-w-0 text-sm">Рейтинг 100–200, якщо його видав сайт<Input type="number" name="ratingScore" min={100} max={200} defaultValue={a.result?.ratingScore??""}/></label>
        <label className="min-w-0 text-sm">Помилок, якщо відомо<Input type="number" name="errorCount" min={0} max={a.questionCount} defaultValue={a.result?.errorCount??""}/></label>
        <label className="min-w-0 text-sm sm:col-span-2">Складні теми / коментар<Textarea name="comment" maxLength={2000} defaultValue={a.result?.comment??""}/></label>
        <p className="text-xs text-muted-foreground sm:col-span-2">Рейтинг не обчислюємо. Самооцінка не змінює засвоєння тем і не створює автоматичних помилок. Попередні редакції результату зберігаються.</p><Button disabled={pending}>{pending?"Збереження…":"Зберегти самооцінку"}</Button>
      </form></details>:null}
    {!terminal&&!complete?<div className="space-y-2"><form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);run(()=>changeExternalTask(a.id,"move",String(fd.get("date"))));}}><label className="min-w-0 text-sm">Нова навчальна дата<Input name="date" type="date" min={dateKey()} required/></label><Button variant="outline" disabled={pending}>Перенести</Button></form><Button variant="secondary" disabled={pending} onClick={()=>{if(window.confirm("Пропустити цей варіант? Наступним буде наступний підтверджений варіант цього предмета."))run(()=>changeExternalTask(a.id,"skip"));}}>Пропустити варіант</Button></div>:null}
    {message?<p role="status" className="text-sm">{message}</p>:null}
  </Card>;
}
