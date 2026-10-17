import Link from "next/link";
import { STATUS_LABEL } from "@/lib/constants";
import { dateKey, daysBetween, formatUk, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { recommendTopics } from "@/lib/recommend";
import { averageOfLatestFull, computeStreak, weekCompletion } from "@/lib/scoring";
import { plural } from "@/lib/utils";
import { TaskControls } from "@/components/task-controls";
import { Badge, Card, PageHeader, Progress } from "@/components/ui";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function DashboardPage() {
  const user = await requireUser();
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
    prisma.examResult.findMany({ where: { userId: user.id, subjectId: { in: [...activeIds] } } }),
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

  return (
    <div className="space-y-6">
      <PageHeader title={`Привіт, ${user.firstName}! Продовжимо підготовку до НМТ-${user.examYear}?`} description={`Ціль ${settings.targetScore}. ${nextMock ? `Найближчий пробник: ${formatUk(nextMock.dateKey)}.` : "Найближчий пробник з'явиться в календарі."}`} />
      {todayTopic ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-sm text-muted-foreground">Сьогодні тобі потрібно пройти</div>
            <div className="text-lg font-semibold">{todaySubject?.name ?? "Предмет"} — {todayTopic.title}</div>
          </div>
          <Link href={`/learn/${todayTopic.id}`} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Почати навчання</Link>
        </Card>
      ) : <Card className="p-4 text-sm">На сьогодні тема ще не призначена. Оберіть предмет у бібліотеці.</Card>}
      {today < settings.planStart ? <Card className="p-4 text-sm">Активна підготовка починається {formatUk(settings.planStart)}. Нижче вже зібрано план першого дня.</Card> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="До НМТ" value={examKey ? `${daysBetween(today, examKey)} дн.` : "Дату не задано"} href="/settings" />
        <Metric label="Середній рейтинговий бал" value={average.value === null ? "Недостатньо даних" : String(average.value)} hint={`Ціль ${settings.targetScore}`} />
        <Metric label="Засвоєні теми" value={`${mastered} із ${leaves.length}`} />
        <Metric label="Завершені тести" value={String(attempts)} />
        <Metric label="Тижневий план" value={`${weekCompletion(weekTasks)}%`} />
        <Metric label="Навчальний час за тиждень" value={`${weekMinutes} хв`} />
        <Metric label="Серія днів" value={String(streak)} hint="Неділя не перериває серію" />
        <Metric label="Досвід" value={`${xp._sum.amount ?? 0} XP`} hint={achievements.length ? achievements.map((item) => item.title).join(", ") : "Досягнення ще попереду"} />
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">{focusDate === today ? "Сьогоднішній план" : `План на ${formatUk(focusDate)}`}</h2>
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground">На цей день занять немає.</p> : tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{task.title}</div>
                  <div className="text-sm text-muted-foreground">{task.detail} · {task.durationMin} хв</div>
                </div>
                <Badge>{task.optional ? "Необов'язково" : "Обов'язково"}</Badge>
              </div>
              <div className="mt-3"><TaskControls task={task} /></div>
            </div>
          ))}
          {reviews.length ? (
            <div className="rounded-xl bg-muted p-3 text-sm">
              <div className="font-medium">Повторення слабких тем</div>
              {reviews.map((review) => <Link key={review.id} href={`/topics/${review.topicId}`} className="mt-1 block underline">{review.topic.title} · через інтервал {review.intervalDays} дн.</Link>)}
            </div>
          ) : null}
        </Card>
        <Card className="space-y-2 p-4">
          <h2 className="font-medium">Швидкі дії</h2>
          <Quick href={continueTopic ? `/topics/${continueTopic.id}` : "/subjects"} label="Продовжити навчання" />
          <Quick href="/tests" label="Пройти тест" />
          <Quick href="/results#add" label="Додати результат пробника" />
          <Quick href="/mistakes" label="Повторити помилки" />
          <Quick href="/calendar" label="Відкрити календар" />
          <Quick href="/ai-tutor" label="Запитати AI-репетитора" />
        </Card>
      </section>
      {overdue.length ? (
        <Card className="p-4">
          <h2 className="font-medium">Пропущені заняття</h2>
          <div className="mt-3 space-y-2">
            {overdue.map((task) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{formatUk(task.dateKey)} · {task.title}</span>
                <TaskControls task={task} />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2">
        {subjects.map((subject) => {
          const subjectLeaves = leaves.filter((topic) => topic.subjectId === subject.id);
          const done = subjectLeaves.filter((topic) => topic.status === "MASTERED").length;
          const percent = subjectLeaves.length ? Math.round((done / subjectLeaves.length) * 100) : 0;
          return (
            <Link key={subject.id} href={`/subjects/${subject.id}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{subject.name}</div>
                  <div className="text-sm text-muted-foreground">{done} {plural(done, "тему засвоєно", "теми засвоєно", "тем засвоєно")}</div>
                </div>
                <span className="h-3 w-3 rounded-full" style={{ background: subject.color }} />
              </div>
              <div className="mt-3"><Progress value={percent} /></div>
            </Link>
          );
        })}
      </section>
      <Card className="p-4">
        <h2 className="font-medium">Що варто зробити далі</h2>
        <div className="mt-3 space-y-2">
          {recommendations.map((topic) => (
            <Link key={topic.id} href={`/topics/${topic.id}`} className="block rounded-xl border border-border p-3 hover:bg-accent">
              <div className="font-medium">{topic.title}</div>
              <div className="text-sm text-muted-foreground">{STATUS_LABEL[topic.status]} · {topic.reason}</div>
            </Link>
          ))}
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">{average.value === null ? "Середній рейтинговий бал: недостатньо даних." : `Середній рейтинговий бал ${average.value}. До цілі ${settings.targetScore} залишилось ${Math.round((settings.targetScore - average.value) * 10) / 10} бала.`} Тематичні тести в цей бал не входять.</p>
    </div>
  );
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

function Quick({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="block rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent">{label}</Link>;
}
