import Link from "next/link";
import { SUBJECTS } from "@/lib/constants";
import { dateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { averageForMonth, averageForSubject, averageOfLatestFull, changeFromInitial, changeFromPrevious, formatDelta, overallChange } from "@/lib/scoring";
import { Bars, RatingChart } from "@/components/charts";
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
  const progressStatus = new Map(progress.map((item) => [item.topicId, item.status]));
  const points = results.filter((result) => activeIds.includes(result.subjectId)).map((result) => ({
    subjectId: result.subjectId,
    date: result.date.toISOString().slice(0, 10),
    ratingScore: result.ratingScore,
    partial: result.partial,
    belowThreshold: result.belowThreshold,
    countsTowardAverage: result.countsTowardAverage,
  }));
  const today = dateKey();
  const filtered = selected.days === 0 ? points : points.filter((point) => point.date >= shift(today, -selected.days));
  const rows = mergeRows(filtered.filter((point) => point.ratingScore !== null && point.countsTowardAverage));
  const month = today.slice(0, 7);
  const leaves = topics.filter((topic) => !topics.some((child) => child.parentId === topic.id));
  const weak = [...mistakes.reduce((map, mistake) => {
    const key = mistake.topic?.title ?? mistake.subjectId;
    map.set(key, (map.get(key) ?? 0) + mistake.repeatCount);
    return map;
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const monthMap = new Map<string, { tests: number; minutes: number }>();
  for (const attempt of attempts) {
    const key = (attempt.finishedAt ?? attempt.startedAt).toISOString().slice(0, 7);
    const row = monthMap.get(key) ?? { tests: 0, minutes: 0 };
    row.tests += 1;
    monthMap.set(key, row);
  }
  for (const session of sessions) {
    const key = session.startedAt.toISOString().slice(0, 7);
    const row = monthMap.get(key) ?? { tests: 0, minutes: 0 };
    row.minutes += session.durationMin;
    monthMap.set(key, row);
  }
  const answered = attempts.reduce((sum, attempt) => sum + (attempt.totalCount ?? 0), 0);
  const correct = attempts.reduce((sum, attempt) => sum + (attempt.correctCount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Аналітика" description="Рейтингові лінії будуються лише з результатів, які ви позначили повними. Часткові тести сюди не входять." action={<a className="text-sm underline" href="/api/export/results">Експорт CSV</a>} />
      <div className="flex flex-wrap gap-2 text-sm">
        {ranges.map((item) => <Link key={item.id} href={`/analytics?range=${item.id}`} className="rounded-lg bg-muted px-3 py-1.5">{item.label}</Link>)}
      </div>
      <Card className="p-4"><RatingChart rows={rows} /></Card>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Stat title="Середній бал останніх повних результатів" value={show(averageOfLatestFull(filtered, activeIds))} />
        <Stat title="Середній бал за поточний місяць" value={show(averageForMonth(points, month))} />
        <Stat title="Зміна від попереднього пробника" value={formatDelta(overallChange(filtered, activeIds, "previous").value)} />
        <Stat title="Зміна від початкового результату" value={formatDelta(overallChange(filtered, activeIds, "initial").value)} />
        <Stat title="Виконані завдання в тестах" value={answered ? String(answered) : "Недостатньо даних"} />
        <Stat title="Частка правильних у тестах" value={answered ? `${Math.round((correct / answered) * 100)}%` : "Недостатньо даних"} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Середній бал предмета</h2>
          {SUBJECTS.filter((subject) => activeIds.includes(subject.id)).map((subject) => {
            const value = averageForSubject(filtered, subject.id);
            const previous = changeFromPrevious(filtered, subject.id);
            const initial = changeFromInitial(filtered, subject.id);
            return <p key={subject.id} className="text-sm">{subject.name}: {value.value ?? "Недостатньо даних"} · від попереднього {formatDelta(previous.value)} · від старту {formatDelta(initial.value)}</p>;
          })}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Засвоєні теми</h2>
          <Bars rows={SUBJECTS.filter((subject) => activeIds.includes(subject.id)).map((subject) => ({ name: subject.shortName, value: leaves.filter((topic) => topic.subjectId === subject.id && (progressStatus.get(topic.id) ?? "NOT_STARTED") === "MASTERED").length }))} labelText="Засвоєно" />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Найслабші теми</h2>
          {weak.length === 0 ? <p className="text-sm text-muted-foreground">Недостатньо даних. Після тестів тут буде список помилок.</p> : weak.map(([title, count]) => <p key={title} className="text-sm">{title}: {count}</p>)}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Динаміка за місяцями</h2>
          {monthMap.size === 0 ? <p className="text-sm text-muted-foreground">Недостатньо даних про час навчання.</p> : [...monthMap.entries()].map(([key, value]) => <p key={key} className="text-sm">{key}: {value.tests} тестів, {value.minutes} хв</p>)}
        </Card>
      </section>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return <Card className="p-4"><div className="text-sm text-muted-foreground">{title}</div><div className="mt-1 text-xl font-semibold">{value}</div></Card>;
}

function show(result: { value: number | null; label: string }) {
  return result.value === null ? "Недостатньо даних" : String(result.value);
}

function mergeRows(points: { subjectId: string; date: string; ratingScore: number | null }[]) {
  const map = new Map<string, Record<string, string | number | null>>();
  for (const point of points) {
    const row = map.get(point.date) ?? { date: point.date, math: null, ukrainian: null, history: null, biology: null };
    row[point.subjectId] = point.ratingScore;
    map.set(point.date, row);
  }
  return [...map.values()];
}

function shift(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
