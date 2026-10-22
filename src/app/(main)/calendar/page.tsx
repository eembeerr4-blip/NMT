import { ChevronLeft, ChevronRight } from "lucide-react";
import { syncPlan, getSettings } from "@/server/sync";
import Link from "next/link";
import { addMonths } from "date-fns";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { addDateKeys, dateKey, formatUk, isDateKey, monthBounds, parseDateKey, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { TaskControls } from "@/components/task-controls";
import { Button, Card, PageHeader } from "@/components/ui";

import { requireUser } from "@/server/session";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const user = await requireUser();
  await syncPlan(user.id);
  const settings=await getSettings(user.id);
  const params = await searchParams;
  const view = params.view === "day" || params.view === "week" || params.view === "month" ? params.view : "week";
  const anchor = isDateKey(params.date) ? params.date : dateKey();
  const month = monthBounds(parseDateKey(anchor));
  const range = view === "day"
    ? { from: anchor, to: anchor }
    : view === "week"
      ? { from: dateKey(startOfWeekMonday(parseDateKey(anchor))), to: addDateKeys(dateKey(startOfWeekMonday(parseDateKey(anchor))), 6) }
      : { from: month.start, to: month.end };
  const [tasks, reviews] = await Promise.all([
    prisma.studyTask.findMany({ where: { userId: user.id, dateKey: { gte: range.from, lte: range.to }, status: { not: "DROPPED" } }, orderBy: [{ dateKey: "asc" }, { sortOrder: "asc" }] }),
    prisma.reviewSchedule.findMany({ where: { userId: user.id, status: "PENDING", dueKey: { gte: range.from, lte: range.to } }, include: { topic: true } }),
  ]);
  const days = each(range.from, range.to);
  const selectedTasks=tasks.filter(task=>task.dateKey===anchor);
  const leading=view==="month"?(parseDateKey(range.from).getDay()+6)%7:0;
  const previous=view==="month"?dateKey(addMonths(parseDateKey(anchor),-1)):addDateKeys(anchor,view==="week"?-7:-1);
  const next=view==="month"?dateKey(addMonths(parseDateKey(anchor),1)):addDateKeys(anchor,view==="week"?7:1);
  return <div className="space-y-6"><PageHeader title="Календар" description="Ваш план навчання та повторення."/>
    <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Вигляд календаря" className="flex gap-2">{[["day","День"],["week","Тиждень"],["month","Місяць"]].map(([key,label])=><Button key={key} asChild variant={view===key?"default":"outline"}><Link href={`/calendar?view=${key}&date=${anchor}`} aria-current={view===key?"page":undefined}>{label}</Link></Button>)}</nav><div className="flex items-center gap-2"><Button asChild variant="outline" size="icon"><Link href={`/calendar?view=${view}&date=${previous}`} aria-label="Попередній період"><ChevronLeft/></Link></Button><span className="px-2 text-sm font-semibold">{formatUk(anchor,view==="day"?"d MMMM yyyy":"LLLL yyyy")}</span><Button asChild variant="outline" size="icon"><Link href={`/calendar?view=${view}&date=${next}`} aria-label="Наступний період"><ChevronRight/></Link></Button></div></div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]"><Card className="overflow-hidden p-3 sm:p-5">{view!=="day"?<><div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">{["Пн","Вт","Ср","Чт","Пт","Сб","Нд"].map(label=><span key={label} className="py-2">{label}</span>)}</div><div className="grid grid-cols-7 gap-1 sm:gap-2">{Array.from({length:leading},(_,index)=><div key={`blank-${index}`} aria-hidden="true"/>)}{days.map(day=>{const items=tasks.filter(task=>task.dateKey===day&&!["DROPPED","MOVED"].includes(task.status));const selected=day===anchor;const isToday=day===dateKey();return <Link key={day} href={`/calendar?view=${view}&date=${day}`} aria-current={selected?"date":undefined} aria-label={`${formatUk(day)}, ${items.length} занять`} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-center text-sm transition sm:min-h-20 ${selected?"border-primary bg-action text-primary-foreground":isToday?"border-primary/60 bg-accent text-foreground":"border-border bg-background/40 hover:border-primary/50"}`}><span className="font-semibold">{Number(day.slice(-2))}</span>{items.length?<><span className={`hidden text-[11px] sm:block ${selected?"text-primary-foreground":"text-muted-foreground"}`}>{items.length} занять</span><span className={`h-1 w-1 rounded-full ${selected?"bg-white":"bg-primary"}`}/></>:null}</Link>;})}</div></>:<div className="space-y-2 p-4"><p className="text-sm text-muted-foreground">{WEEKDAY_LABELS[parseDateKey(anchor).getDay()]}</p><h2 className="text-2xl font-semibold">{formatUk(anchor)}</h2><p className="text-sm text-muted-foreground">Деталі занять цього дня — у плані поруч.</p></div>}</Card>
    <Card className="space-y-4 p-5 xl:sticky xl:top-20"><div><h2 className="font-semibold">{formatUk(anchor)}</h2><p className="mt-1 text-sm text-muted-foreground">План на день</p></div>{selectedTasks.length?selectedTasks.map(task=><div key={task.id} className="space-y-2 rounded-xl border border-border bg-background/40 p-3"><p className="text-sm font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.durationMin} хв · {task.status==="DONE"?"Виконано":task.status==="IN_PROGRESS"?"У процесі":task.status==="MOVED"?"Перенесено":task.status==="SKIPPED"?"Пропущено":"Заплановано"}</p><details><summary className="cursor-pointer text-xs text-muted-foreground">Дії із заняттям</summary><div className="pt-2"><TaskControls task={task}/></div></details>{task.notes?<p className="text-xs text-muted-foreground">{task.notes}</p>:null}</div>):<p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">На цей день занять немає.</p>}{reviews.filter(review=>review.dueKey===anchor).map(review=><Link key={review.id} href={`/learn/${review.topicId}`} className="block rounded-xl bg-accent p-3 text-sm">Повторення: {review.topic.title} →</Link>)}<p className="text-xs leading-5 text-muted-foreground">Заплановано {selectedTasks.filter(task=>!["MOVED","SKIPPED","DROPPED"].includes(task.status)).reduce((sum,task)=>sum+task.durationMin,0)} хв · ваша денна ціль {settings.dailyMinutes} хв</p></Card></div>
  </div>;
}


function each(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < 42) {
    days.push(cursor);
    cursor = addDateKeys(cursor, 1);
  }
  return days;
}
