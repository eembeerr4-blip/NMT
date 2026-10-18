import { DiagnosticStart } from "@/components/diagnostic-start";
import Link from "next/link";
import { STATUS_LABEL } from "@/lib/constants";
import { addDateKeys, dateKey, daysBetween, formatUk, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { recommendTopics } from "@/lib/recommend";
import { averageOfLatestFull, computeStreak, weekCompletion } from "@/lib/scoring";
import { ArrowRight, CalendarDays } from "lucide-react";
import { SubjectIcon } from "@/components/subject-icon";
import { Bars } from "@/components/charts";
import { TaskControls } from "@/components/task-controls";
import { Button, Card, PageHeader, Progress } from "@/components/ui";
import { requireUser } from "@/server/session";
import { getSettings, syncPlan } from "@/server/sync";

export default async function DashboardPage() {
  const user = await requireUser();
  await syncPlan(user.id);
  const settings = await getSettings(user.id);
  const activeIds = new Set(user.subjects.filter((item) => item.active).map((item) => item.subjectId));
  const today = dateKey();
  const focusDate = today < settings.planStart ? settings.planStart : today;
  const weekStart = dateKey(startOfWeekMonday());
  const weekEndDate = startOfWeekMonday();
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = dateKey(weekEndDate);
  const [tasks, weekTasks, overdue, reviews, subjects, topics, progressRows, results, attempts, sessions, xp, achievements, mistakes, nextMock] = await Promise.all([
    prisma.studyTask.findMany({ where: { userId: user.id, dateKey: focusDate, status: { notIn: ["MOVED", "DROPPED"] } }, orderBy: { sortOrder: "asc" } }),
    prisma.studyTask.findMany({ where: { userId: user.id, dateKey: { gte: weekStart, lte: weekEnd }, status: { not: "DROPPED" } } }),
    prisma.studyTask.findMany({ where: { userId: user.id, dateKey: { lt: today, gte: settings.planStart }, status: "PLANNED", optional: false, kind: { not: "rest" } }, orderBy: { dateKey: "asc" }, take: 5 }),
    prisma.reviewSchedule.findMany({ where: { userId: user.id, status: "PENDING", dueKey: { lte: focusDate } }, include: { topic: true }, orderBy: [{ priority: "desc" }, { dueKey: "asc" }], take: 5 }),
    prisma.subject.findMany({ where: { id: { in: [...activeIds] } }, orderBy: { sortOrder: "asc" } }),
    prisma.topic.findMany(),
    prisma.userTopicProgress.findMany({ where: { userId: user.id } }),
    prisma.examResult.findMany({ where: { userId: user.id, subjectId: { in: [...activeIds] } }, include: { subject: true } }),
    prisma.testAttempt.count({ where: { userId: user.id, status: "COMPLETED" } }),
    prisma.studySession.findMany({ where: { userId: user.id } }),
    prisma.xpEvent.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
    prisma.achievement.findMany({ where: { userId: user.id, unlockedAt: { not: null } } }),
    prisma.mistake.findMany({ where: { userId: user.id, status: { not: "FIXED" } } }),
    prisma.studyTask.findFirst({ where: { userId: user.id, kind: "mock", status: "PLANNED", dateKey: { gte: today } }, orderBy: { dateKey: "asc" } }),
  ]);
  const points = results.map((result) => ({
    subjectId: result.subjectId,
    date: result.date.toISOString().slice(0, 10),
    ratingScore: result.ratingScore,
    partial: result.partial,
    belowThreshold: result.belowThreshold,
    countsTowardAverage: result.countsTowardAverage,
  }));
  const average = averageOfLatestFull(points, [...activeIds]);
  const progress = new Map(progressRows.map((item) => [item.topicId, item.status]));
  const leaves = topics.filter((topic) => activeIds.has(topic.subjectId) && !topics.some((child) => child.parentId === topic.id)).map((topic) => ({ ...topic, status: progress.get(topic.id) ?? "NOT_STARTED" }));
  const mastered = leaves.filter((topic) => topic.status === "MASTERED").length;
  const weekMinutes = sessions.filter((session) => dateKey(session.startedAt) >= weekStart && dateKey(session.startedAt) <= weekEnd).reduce((sum, session) => sum + session.durationMin, 0);
  const streak = computeStreak(sessions.filter((session) => session.durationMin > 0).map((session) => dateKey(session.startedAt)), today);
  const examKey = settings.examDate ? settings.examDate.toISOString().slice(0, 10) : null;
  const mistakeCount = new Map<string, number>();
  for (const mistake of mistakes) if (mistake.topicId) mistakeCount.set(mistake.topicId, (mistakeCount.get(mistake.topicId) ?? 0) + mistake.repeatCount);
  const recommendations = recommendTopics(leaves.map((topic) => ({ ...topic, mistakeCount: mistakeCount.get(topic.id) ?? 0 })), {
    math: settings.mathPriority,
    ukrainian: settings.ukrainianPriority,
    history: settings.historyPriority,
    biology: settings.biologyPriority,
  });
  const continueTopic = leaves.find((topic) => topic.status === "IN_PROGRESS") ?? recommendations[0];
  const todayTask = tasks.find((task) => task.topicId && task.kind !== "rest") ?? null;
  const todayTopic = todayTask?.topicId ? topics.find((topic) => topic.id === todayTask.topicId) : continueTopic;
  const todaySubject = todayTopic ? subjects.find((subject) => subject.id === todayTopic.subjectId) : null;

  const diagnosed = await prisma.testAttempt.findFirst({ where: { userId: user.id, status: "COMPLETED", test: { kind: "DIAGNOSTIC" } } });
  const activity=Array.from({length:7},(_,index)=>{
    const key=addDateKeys(weekStart,index);
    return {name:formatUk(key,"EEEEEE"),value:sessions.filter(session=>dateKey(session.startedAt)===key).reduce((sum,session)=>sum+session.durationMin,0)};
  });
  return <div className="space-y-6">
    <PageHeader title={`Привіт, ${user.firstName}!`} description={`Продовжимо підготовку до НМТ-${user.examYear}?`} action={<nav aria-label="Дні поточного тижня" className="flex flex-wrap gap-1.5">{activity.map((day,index)=>{const key=addDateKeys(weekStart,index);return <Link key={key} href={`/calendar?view=day&date=${key}`} aria-current={key===today?"date":undefined} className={`grid min-w-10 gap-1 rounded-xl border px-2.5 py-2 text-center text-xs ${key===today?"border-primary bg-primary text-primary-foreground":"border-border bg-card text-muted-foreground hover:border-primary/50"}`}><span>{day.name}</span><span className="font-semibold">{Number(key.slice(-2))}</span></Link>;})}</nav>}/>
    <div className="grid items-stretch gap-4 xl:grid-cols-[1.35fr_1fr]">
      <Card className="relative flex min-h-52 flex-col justify-between gap-6 overflow-hidden border-primary/25 p-5 sm:p-6"><div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"/><div className="relative space-y-3"><p className="text-sm font-semibold text-muted-foreground">Продовжити навчання</p>{todayTopic?<><div className="flex items-center gap-3"><SubjectIcon id={todayTopic.subjectId}/><div><h2 className="text-xl font-semibold">{todaySubject?.name??"Предмет"}</h2><p className="mt-1 text-sm text-muted-foreground">{todayTopic.title}</p></div></div><p className="text-sm text-muted-foreground">Поверніться до матеріалу та рухайтеся у своєму темпі.</p></>:<><h2 className="text-xl font-semibold">Почнімо з вашого предмета</h2><p className="text-sm text-muted-foreground">Уроки можна вивчати й без попередньої діагностики.</p></>}</div><div className="relative"><Button asChild><Link href={todayTopic?`/learn/${todayTopic.id}`:"/subjects"}>{todayTopic?"Продовжити урок":"Обрати предмет"}<ArrowRight className="h-4 w-4"/></Link></Button></div></Card>
      <Card className="space-y-4 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{focusDate===today?"План на сьогодні":`План на ${formatUk(focusDate,"d MMMM")}`}</h2><Link href="/calendar" className="text-sm font-semibold text-primary">Календар →</Link></div>{tasks.length?tasks.slice(0,4).map(task=><div key={task.id} className="rounded-xl border border-border p-3"><div className="flex items-start gap-3"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${task.status==="DONE"?"border-primary bg-primary":"border-muted-foreground"}`}/><div className="min-w-0 flex-1"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.durationMin} хв · {task.status==="DONE"?"Виконано":task.status==="IN_PROGRESS"?"У процесі":"Заплановано"}</p><details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Керувати заняттям</summary><div className="pt-2"><TaskControls task={task}/></div></details></div></div></div>):<p className="py-6 text-sm text-muted-foreground">На цей день занять немає. Відпочиньте або оберіть урок самостійно.</p>}{tasks.length>4?<Link href="/calendar" className="block text-sm text-primary">Увесь план на день →</Link>:null}</Card>
    </div>
    {!user.diagnosticSkipped&&!diagnosed?<Card className="space-y-3 p-5"><h2 className="font-semibold">Хочете визначити, з чого почати?</h2><p className="text-sm text-muted-foreground">Коротка діагностика допоможе обрати теми для повторення. Її можна пропустити.</p><DiagnosticStart/></Card>:null}
    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Мої предмети</h2><Link href="/subjects" className="text-sm font-semibold text-primary">Усі предмети →</Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{subjects.map(subject=>{const subjectLeaves=leaves.filter(topic=>topic.subjectId===subject.id);const done=subjectLeaves.filter(topic=>topic.status==="MASTERED").length;const percent=subjectLeaves.length?Math.round(done/subjectLeaves.length*100):0;return <Link key={subject.id} href={`/subjects/${subject.id}`}><Card className="h-full space-y-4 p-4 transition hover:border-primary/50"><div className="flex items-center gap-3"><SubjectIcon id={subject.id} small/><h3 className="text-sm font-semibold">{subject.name}</h3></div><div><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Засвоєння тем</span><span className="font-semibold text-foreground">{percent}%</span></div><Progress value={percent}/></div><p className="text-xs text-muted-foreground">{done} із {subjectLeaves.length} тем засвоєно</p></Card></Link>;})}</div></section>
    <section className="grid gap-4 xl:grid-cols-[1fr_1.35fr]"><Card className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Останні результати</h2><Link href="/results" className="text-sm font-semibold text-primary">Усі →</Link></div>{results.length?[...results].sort((a,b)=>b.date.getTime()-a.date.getTime()).slice(0,4).map(result=><Link key={result.id} href="/results" className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 hover:bg-muted"><SubjectIcon id={result.subjectId} small/><div className="min-w-0 flex-1"><p className="text-sm font-medium">{result.subject.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatUk(result.date)} · {result.title}</p></div><span className="shrink-0 text-sm font-semibold">{result.ratingScore!==null?`${result.ratingScore} балів`:result.rawScore!==null?`${result.rawScore}/${result.maxRawScore??"—"}`:"Без бала"}</span></Link>):<div className="space-y-3 py-5"><p className="text-sm text-muted-foreground">Результатів ще немає. Тут з’являться ваші збережені оцінки.</p><Button asChild variant="outline"><Link href="/results#add">Додати результат</Link></Button></div>}</Card><Card className="space-y-3 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Статистика підготовки</h2><span className="text-xs text-muted-foreground">Поточний тиждень · хвилини</span></div>{weekMinutes>0?<Bars rows={activity} labelText="Навчальний час, хв"/>:<div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 px-5 text-center"><CalendarDays className="h-7 w-7 text-muted-foreground"/><p className="text-sm font-medium">Цього тижня навчальний час ще не записано</p><p className="text-xs leading-5 text-muted-foreground">Завершуйте заняття в календарі або записуйте час у темі — тут з’явиться ваша активність.</p></div>}</Card></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Середній рейтинговий бал" value={average.value===null?"Недостатньо даних":String(average.value)} hint={`Ваша ціль — ${settings.targetScore}`}/><Metric label="Засвоєні теми" value={`${mastered} із ${leaves.length}`}/><Metric label="Завершені тести" value={String(attempts)}/><Metric label="План тижня" value={`${weekCompletion(weekTasks)}%`}/></section>
    <details className="rounded-2xl border border-border bg-card p-5"><summary className="cursor-pointer font-semibold">Рекомендації та додаткові показники</summary><div className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="До НМТ" value={examKey?`${daysBetween(today,examKey)} дн.`:"Дату не задано"} href="/settings"/><Metric label="Серія навчання" value={`${streak} дн.`}/><Metric label="Досвід" value={`${xp._sum.amount??0} XP`} hint={achievements.length?`${achievements.length} досягнень`:"Досягнення ще попереду"}/><Metric label="Час за тиждень" value={`${weekMinutes} хв`}/></div>{recommendations.slice(0,4).map(topic=><Link key={topic.id} href={`/topics/${topic.id}`} className="block rounded-xl bg-muted p-3 text-sm"><span className="font-medium">{topic.title}</span><span className="mt-1 block text-muted-foreground">{STATUS_LABEL[topic.status]}</span></Link>)}{overdue.length?<p className="text-sm text-muted-foreground">Є незавершені заняття: <Link className="text-primary" href="/calendar">переглянути календар →</Link></p>:null}{reviews.length?<Link href="/review" className="block text-sm text-primary">Повторити теми: {reviews.length} →</Link>:null}{nextMock?<Link href="/exams" className="block text-sm text-primary">Наступний пробник: {formatUk(nextMock.dateKey)} →</Link>:null}</div></details>
  </div>;
}


function Metric({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <Card className="h-full p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

