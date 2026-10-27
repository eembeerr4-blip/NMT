import Link from "next/link";
import { SUBJECTS } from "@/lib/constants";
import { SubjectIcon } from "@/components/subject-icon";
import { EmptyState, Progress } from "@/components/ui";
import { dateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { averageForMonth, averageForSubject, averageOfLatestFull, changeFromInitial, changeFromPrevious, formatDelta, overallChange } from "@/lib/scoring";
import { Bars } from "@/components/charts";
import { ResultsDynamicsSection, type DynamicsResult } from "@/components/analytics/results-dynamics";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";

const ranges = [
  { id: "week", label: "Тиждень", days: 7 },
  { id: "month", label: "Місяць", days: 30 },
  { id: "quarter", label: "Три місяці", days: 90 },
  { id: "all", label: "Увесь період", days: 0 },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const activeIds = user.subjects.filter((item) => item.active).map((item) => item.subjectId);
  const { range = "all" } = await searchParams;
  const selected = ranges.find((item) => item.id === range) ?? ranges[3];
  const [results, attempts, sessions, topics, mistakes, progress] = await Promise.all([
    prisma.examResult.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.testAttempt.findMany({ where: { userId: user.id, status: "COMPLETED" }, include: { test: true } }),
    prisma.studySession.findMany({ where: { userId: user.id } }),
    prisma.topic.findMany(),
    prisma.mistake.findMany({ where: { userId: user.id, status: { not: "FIXED" } }, include: { topic: true } }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id } }),
  ]);
  const today = dateKey();
  const fromDate = selected.days === 0 ? null : shift(today, -selected.days);
  const inRange = (date: Date) => !fromDate || date.toISOString().slice(0, 10) >= fromDate;
  const rangedAttempts = attempts.filter((attempt) => inRange(attempt.finishedAt ?? attempt.startedAt));
  const rangedSessions = sessions.filter((session) => inRange(session.startedAt));
  const progressStatus = new Map(progress.map((item) => [item.topicId, item.status]));
  const points = results.filter((result) => activeIds.includes(result.subjectId)).map((result) => ({
    subjectId: result.subjectId,
    date: result.date.toISOString().slice(0, 10),
    ratingScore: result.ratingScore,
    partial: result.partial,
    belowThreshold: result.belowThreshold,
    countsTowardAverage: result.countsTowardAverage,
  }));
  const filtered = selected.days === 0 ? points : points.filter((point) => point.date >= shift(today, -selected.days));
  const month = today.slice(0, 7);
  const leaves = topics.filter((topic) => activeIds.includes(topic.subjectId) && !topics.some((child) => child.parentId === topic.id));
  const weak = [...mistakes.filter((mistake) => activeIds.includes(mistake.subjectId)).reduce((map, mistake) => {
    const key = mistake.topic?.title ?? mistake.subjectId;
    map.set(key, (map.get(key) ?? 0) + mistake.repeatCount);
    return map;
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const monthMap = new Map<string, { tests: number; minutes: number }>();
  for (const attempt of rangedAttempts) {
    const key = (attempt.finishedAt ?? attempt.startedAt).toISOString().slice(0, 7);
    const row = monthMap.get(key) ?? { tests: 0, minutes: 0 };
    row.tests += 1;
    monthMap.set(key, row);
  }
  for (const session of rangedSessions) {
    const key = session.startedAt.toISOString().slice(0, 7);
    const row = monthMap.get(key) ?? { tests: 0, minutes: 0 };
    row.minutes += session.durationMin;
    monthMap.set(key, row);
  }
  const answered = rangedAttempts.reduce((sum, attempt) => sum + (attempt.totalCount ?? 0), 0);
  const correct = rangedAttempts.reduce((sum, attempt) => sum + (attempt.correctCount ?? 0), 0);
  const subjectIds = SUBJECTS.filter((subject) => activeIds.includes(subject.id)).map((subject) => subject.id);
  const masteredRows = SUBJECTS.filter((subject) => activeIds.includes(subject.id)).map((subject) => {
    const subjectTopics = leaves.filter((topic) => topic.subjectId === subject.id);
    return { name: subject.shortName, value: subjectTopics.filter((topic) => progressStatus.get(topic.id) === "MASTERED").length };
  }).filter((row) => row.value > 0);
  const studyTimeRows = [...monthMap.entries()].filter(([, value]) => value.minutes > 0).slice(-6).map(([key, value]) => ({ name: formatMonth(key), value: value.minutes }));
  const dynamicsBySubject = results.reduce<Record<string, DynamicsResult[]>>((map, result) => {
    if (!activeIds.includes(result.subjectId) || result.ratingScore === null || !result.countsTowardAverage || result.partial) return map;
    if (!inRange(result.date)) return map;
    const row: DynamicsResult = {
      date: result.date.toISOString().slice(0, 10),
      ratingScore: result.ratingScore,
      title: result.title,
      testType: result.testType,
    };
    map[result.subjectId] = [...(map[result.subjectId] ?? []), row];
    return map;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader title="Мій прогрес" description="Ваші результати, засвоєні теми та динаміка підготовки до НМТ." />
      <div className="flex flex-wrap gap-2 text-sm" aria-label="Період аналітики">
        {ranges.map((item) => <Link key={item.id} href={`/analytics?range=${item.id}`} aria-current={selected.id === item.id ? "page" : undefined} className={`rounded-xl border px-3 py-2 font-medium transition-colors ${selected.id === item.id ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>{item.label}</Link>)}
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{SUBJECTS.filter(subject=>activeIds.includes(subject.id)).map(subject=>{const subjectLeaves=leaves.filter(topic=>topic.subjectId===subject.id);const mastered=subjectLeaves.filter(topic=>progressStatus.get(topic.id)==="MASTERED").length;const percent=subjectLeaves.length?Math.round(mastered/subjectLeaves.length*100):null;const latest=[...filtered].reverse().find((point)=>point.subjectId===subject.id&&point.ratingScore!==null&&point.countsTowardAverage);return <Card key={subject.id} className="space-y-4 p-4 sm:p-5"><div className="flex items-center gap-3"><SubjectIcon id={subject.id} small/><h2 className="text-base font-semibold">{subject.name}</h2></div><div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Засвоєні теми</p><p className="mt-1 text-sm font-semibold">{subjectLeaves.length?`${mastered} із ${subjectLeaves.length}`:"Матеріали ще готуються"}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Останній рейтинговий бал</p><p className="mt-1 text-lg font-bold">{latest?.ratingScore ?? "—"}</p></div></div>{percent!==null?<Progress value={percent}/>:<p className="text-xs text-muted-foreground">Тут з’явиться прогрес, щойно будуть доступні теми.</p>}</Card>;})}</section>
      <ResultsDynamicsSection subjects={subjectIds} resultsBySubject={dynamicsBySubject} />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Stat title="Середній бал останніх повних результатів" value={show(averageOfLatestFull(filtered, activeIds))} />
        <Stat title="Середній бал за поточний місяць" value={show(averageForMonth(filtered, month))} />
        <Stat title="Зміна від попереднього пробника" value={formatDelta(overallChange(filtered, activeIds, "previous").value)} />
        <Stat title="Зміна від початкового результату" value={formatDelta(overallChange(filtered, activeIds, "initial").value)} />
        <Stat title="Виконані завдання в тестах" value={answered ? answered.toLocaleString("uk-UA") : "—"} />
        <Stat title="Частка правильних у тестах" value={answered ? `${Math.round((correct / answered) * 100)}%` : "Недостатньо даних"} />
      </section>
      <Card className="p-4 text-sm">Джерела результатів: {results.filter(r=>r.source.includes("SELF_REPORTED")).length} самооцінок ZNO Online (не входять до автоматичного середнього); {attempts.length} автоматично оцінених внутрішніх спроб. Конкретні зовнішні помилки не відомі NMT Academy. <Link className="underline" href="/exams">Переглянути джерела та записи</Link></Card>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Середній бал предмета</h2>
          {SUBJECTS.filter((subject) => activeIds.includes(subject.id)).map((subject) => {
            const value = averageForSubject(filtered, subject.id);
            const previous = changeFromPrevious(filtered, subject.id);
            const initial = changeFromInitial(filtered, subject.id);
            return <div key={subject.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0"><span className="font-medium">{subject.name}</span><span className="text-right text-sm text-muted-foreground">Середній: {value.value ?? "—"} · від попереднього {formatDelta(previous.value)} · від старту {formatDelta(initial.value)}</span></div>;
          })}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Засвоєні теми</h2>
          {masteredRows.length ? <Bars rows={masteredRows} labelText="Засвоєно"/> : <EmptyState title="Поки немає засвоєних тем" text="Завершені теми з’являться в цій діаграмі після практики."/>}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Найслабші теми</h2>
          {weak.length === 0 ? <p className="text-sm text-muted-foreground">Поки немає відкритих помилок. Після проходження тестів тут з’являться теми, які варто повторити.</p> : weak.map(([title, count]) => <p key={title} className="flex justify-between gap-3 border-b border-border py-2 text-sm last:border-0"><span>{title}</span><span className="text-muted-foreground">{count} повторень</span></p>)}
        </Card>
        <Card className="p-4">
          <h2 className="mb-1 font-medium">Час навчання за місяцями</h2>
          <p className="mb-3 text-sm text-muted-foreground">Обліковані навчальні сесії за вибраний період.</p>
          {studyTimeRows.length === 0 ? <p className="text-sm text-muted-foreground">Коли ви зафіксуєте час навчання, тут з’явиться порівняння за місяцями.</p> : <Bars rows={studyTimeRows} labelText="Хвилин"/>}
        </Card>
      </section>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return <Card className="p-4"><div className="text-sm text-muted-foreground">{title}</div><div className="mt-1 text-xl font-semibold">{value}</div></Card>;
}

function show(result: { value: number | null; label: string }) {
  return result.value === null ? "—" : result.value.toLocaleString("uk-UA", { maximumFractionDigits: 1 });
}

function shift(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function formatMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("uk-UA", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}
