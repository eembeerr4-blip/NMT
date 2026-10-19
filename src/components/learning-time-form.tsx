"use client";
import {useRouter} from "next/navigation";
import {saveLearningTime} from "@/server/actions";
import {Button,Card} from "./ui";
import {useActionFeedback} from "./use-action-feedback";
export function LearningTimeForm({dailyMinutes,studyDays}:{dailyMinutes:number;studyDays:number[]}) {
 const {pending,result,run}=useActionFeedback();const router=useRouter();
 return <Card className="space-y-3 p-4"><h2 className="font-semibold">Час навчання</h2><p className="text-sm text-muted-foreground">План враховує денний ліміт і обрані дні. Ваші власні та завершені заняття зберігаються.</p><form className="space-y-4" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);await run(()=>saveLearningTime({dailyMinutes:Number(data.get("dailyMinutes")),studyDays:data.getAll("studyDays").map(Number)}),()=>router.refresh());}}>
  <label className="grid max-w-xs gap-1 text-sm">Хвилин на день<input type="number" name="dailyMinutes" min={15} max={720} defaultValue={dailyMinutes} required disabled={pending}/></label>
  <fieldset disabled={pending} className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-medium">Навчальні дні</legend>{[[1,"Пн"],[2,"Вт"],[3,"Ср"],[4,"Чт"],[5,"Пт"],[6,"Сб"],[0,"Нд"]].map(([day,label])=><label key={day} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm"><input type="checkbox" name="studyDays" value={day} defaultChecked={studyDays.includes(Number(day))}/>{label}</label>)}</fieldset>
  <Button type="submit" disabled={pending}>{pending?"Оновлення плану…":"Зберегти час навчання"}</Button>
  {result?<p role={result.ok?"status":"alert"} className="text-sm">{result.ok?result.message:result.error}</p>:null}
 </form></Card>;
}
