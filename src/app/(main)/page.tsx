import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, Clock3, Play } from "lucide-react";
import { dateKey, formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { recommendTopics } from "@/lib/recommend";
import { lessonAccess } from "@/lib/readiness";
import { SubjectIcon } from "@/components/subject-icon";
import { TaskControls } from "@/components/task-controls";
import { Button } from "@/components/ui";
import { DiagnosticStart } from "@/components/diagnostic-start";
import { DashboardProgress } from "@/components/dashboard/progress-card";
import { dashboardSeries } from "@/components/dashboard/progress-data";
import { requireUser } from "@/server/session";
import { getSettings, syncPlan } from "@/server/sync";

export default async function DashboardPage() {
  const user = await requireUser();
  await syncPlan(user.id);
  const settings = await getSettings(user.id);
  const activeIds = new Set(user.subjects.filter(item => item.active).map(item => item.subjectId));
  const today = dateKey();
  const focusDate = today < settings.planStart ? settings.planStart : today;
  const [tasks, subjects, topics, progressRows, results, attempts, mistakes, nextMock] = await Promise.all([
    prisma.studyTask.findMany({ where: { userId: user.id, dateKey: focusDate, status: { notIn: ["MOVED", "DROPPED"] } }, orderBy: { sortOrder: "asc" } }),
    prisma.subject.findMany({ where: { id: { in: [...activeIds] } }, orderBy: { sortOrder: "asc" } }),
    prisma.topic.findMany({ include: { questions: { where: { verificationStatus: "VERIFIED" }, select: { id: true } }, videos: { select: { reviewStatus: true } } } }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id } }),
    prisma.examResult.findMany({ where: { userId: user.id, subjectId: { in: [...activeIds] } }, include: { subject: true } }),
    prisma.testAttempt.count({ where: { userId: user.id, status: "COMPLETED" } }),
    prisma.mistake.findMany({ where: { userId: user.id, status: { not: "FIXED" } } }),
    prisma.studyTask.findFirst({ where: { userId: user.id, kind: "mock", status: "PLANNED", dateKey: { gte: today } }, orderBy: { dateKey: "asc" } }),
  ]);
  const points = results.map(result => ({ subjectId: result.subjectId, date: result.date.toISOString().slice(0, 10), ratingScore: result.ratingScore, partial: result.partial, belowThreshold: result.belowThreshold, countsTowardAverage: result.countsTowardAverage }));
  const progress = new Map(progressRows.map(item => [item.topicId, item.status]));
  const leaves = topics.filter(topic => activeIds.has(topic.subjectId) && !topics.some(child => child.parentId === topic.id)).map(topic => ({ ...topic, status: progress.get(topic.id) ?? "NOT_STARTED" }));
  const mistakeCount = new Map<string, number>();
  for (const mistake of mistakes) if (mistake.topicId) mistakeCount.set(mistake.topicId, (mistakeCount.get(mistake.topicId) ?? 0) + mistake.repeatCount);
  const availableLeaves = leaves.filter(topic => lessonAccess(topic).available);
  const firstLesson = attempts === 0 && !availableLeaves.some(topic => topic.status !== "NOT_STARTED");
  const recommendations = recommendTopics(availableLeaves.map(topic => ({ ...topic, mistakeCount: mistakeCount.get(topic.id) ?? 0 })), { math: settings.mathPriority, ukrainian: settings.ukrainianPriority, history: settings.historyPriority, biology: settings.biologyPriority });
  const continueTopic = availableLeaves.find(topic => topic.status === "IN_PROGRESS") ?? recommendations[0];
  const todayTask = tasks.find(task => task.topicId && task.kind !== "rest") ?? null;
  const todayTopic = (todayTask?.topicId ? availableLeaves.find(topic => topic.id === todayTask.topicId) : undefined) ?? continueTopic;
  const diagnosed = user.diagnosticSkipped ? null : await prisma.testAttempt.findFirst({ where: { userId: user.id, status: "COMPLETED", test: { kind: "DIAGNOSTIC" } } });
  const visibleTasks = tasks.slice(0, 4);
  const doneCount = tasks.filter(task => task.status === "DONE").length;
  const mockSubject = nextMock?.subjectId ? subjects.find(subject => subject.id === nextMock.subjectId) : null;

  return <div className="d01-dashboard">
    <div className="d01-top-grid">
      <section className="d01-welcome" aria-labelledby="dashboard-welcome-title">
        <p className="d01-eyebrow"><span className="d01-live-dot" />{formatUk(today, "EEEE, d MMMM")}</p>
        <h1 id="dashboard-welcome-title">Привіт, {user.firstName}! <span aria-hidden="true">👋</span></h1>
        <p className="d01-welcome-copy">Час продовжити підготовку до НМТ-{user.examYear}. Ти можеш більше!</p>
        {todayTopic ? <p className="d01-current-lesson"><BookOpen aria-hidden="true" />{todayTopic.title}</p> : <p className="d01-current-lesson">Матеріали готуються. Переглянь доступні предмети.</p>}
        <div className="d01-welcome-actions">
          <Button asChild className="d01-primary-cta"><Link href={todayTopic ? `/learn/${todayTopic.id}` : "/subjects"}>{todayTopic ? firstLesson ? "Почати перший урок" : "Продовжити навчання" : "Переглянути предмети"}<ArrowRight aria-hidden="true" /></Link></Button>
          <Link href="/curriculum?mode=personal" className="d01-text-link">Весь мій план <ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
      <DashboardProgress rows={dashboardSeries(points, [...activeIds])} today={today} />
    </div>

    <section aria-labelledby="dashboard-subjects-title" className="d01-subjects-section">
      <div className="d01-section-heading"><h2 id="dashboard-subjects-title">Мої предмети</h2><Link href="/subjects" className="d01-text-link">Усі предмети <ArrowRight aria-hidden="true" /></Link></div>
      <div className="d01-subject-grid">{subjects.map(subject => {
        const subjectLeaves = leaves.filter(topic => topic.subjectId === subject.id);
        const mastered = subjectLeaves.filter(topic => topic.status === "MASTERED").length;
        const percent = subjectLeaves.length ? Math.round(mastered / subjectLeaves.length * 100) : null;
        return <Link key={subject.id} href={`/subjects/${subject.id}`} className="d01-subject-card d01-panel" data-subject={subject.id}>
          <SubjectIcon id={subject.id} variant="dashboard" />
          <div className="d01-subject-copy"><h3>{subject.name}</h3><p>{percent === null ? "Матеріали готуються" : `${mastered} із ${subjectLeaves.length} тем засвоєно`}</p>{percent !== null ? <div className="d01-subject-progress"><div role="progressbar" aria-label={`Засвоєння: ${subject.name}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div><strong>{percent}%</strong></div> : null}</div>
        </Link>;
      })}</div>
      {!subjects.length ? <div className="d01-panel d01-empty"><p>Обраних предметів поки немає.</p><Link href="/settings" className="d01-text-link">Налаштувати навчання <ArrowRight aria-hidden="true" /></Link></div> : null}
    </section>

    <div className="d01-bottom-grid">
      <section className="d01-panel d01-plan" aria-labelledby="dashboard-plan-title">
        <div className="d01-panel-heading"><div className="d01-heading-with-count"><h2 id="dashboard-plan-title">{focusDate === today ? "План на сьогодні" : `План на ${formatUk(focusDate, "d MMMM")}`}</h2><span aria-label={`Виконано ${doneCount} із ${tasks.length} занять`}>{doneCount}/{tasks.length}</span></div><Link href={`/calendar?view=day&date=${focusDate}`} className="d01-text-link">Увесь план <ArrowRight aria-hidden="true" /></Link></div>
        {visibleTasks.length ? <ul className="d01-task-list">{visibleTasks.map(task => {
          const available = task.topicId && availableLeaves.some(topic => topic.id === task.topicId);
          const href = available ? `/learn/${task.topicId}` : `/calendar?view=day&date=${task.dateKey}`;
          const status = task.status === "DONE" ? "Виконано" : task.status === "IN_PROGRESS" ? "У процесі" : "Заплановано";
          return <li key={task.id} className="d01-task-row" data-subject={task.subjectId ?? "other"}>
            <div className="d01-task-main"><SubjectIcon id={task.subjectId ?? "other"} small variant="dashboard" /><div className="d01-task-copy"><Link href={href} className="d01-task-title">{task.title}</Link><p><Clock3 aria-hidden="true" />{task.durationMin} хв<span className="d01-meta-separator">·</span><span>{status}</span></p></div><Link href={href} className="d01-round-link" aria-label={`Відкрити заняття: ${task.title}`}>{task.status === "DONE" ? <Check aria-hidden="true" /> : <Play aria-hidden="true" />}</Link></div>
            <details className="d01-task-actions"><summary>Дії із заняттям</summary><div><TaskControls task={{ id: task.id, status: task.status, topicId: task.topicId, kind: task.kind }} /></div></details>
          </li>;
        })}</ul> : <div className="d01-empty"><CalendarDays aria-hidden="true" /><p>На цей день занять немає.</p><span>Можна відпочити або обрати урок самостійно.</span><Link href="/subjects" className="d01-text-link">Переглянути предмети <ArrowRight aria-hidden="true" /></Link></div>}
        {tasks.length > 4 ? <Link href={`/calendar?view=day&date=${focusDate}`} className="d01-more-link">Ще {tasks.length - 4} занять у календарі <ChevronRight aria-hidden="true" /></Link> : null}
      </section>

      <section className="d01-panel d01-mocks" aria-labelledby="dashboard-mocks-title">
        <div className="d01-panel-heading"><h2 id="dashboard-mocks-title">Найближчі пробники</h2><Link href="/exams" className="d01-text-link">Усі <ArrowRight aria-hidden="true" /></Link></div>
        {nextMock ? <Link href={`/calendar?view=day&date=${nextMock.dateKey}`} className="d01-mock-row" data-subject={nextMock.subjectId ?? "other"}><SubjectIcon id={nextMock.subjectId ?? "other"} variant="dashboard" /><div><p className="d01-eyebrow">{formatUk(nextMock.dateKey, "d MMMM")}</p><h3>{nextMock.title}</h3><p>{mockSubject?.name ?? "Пробний тест"} · {nextMock.durationMin} хв</p></div><ChevronRight aria-hidden="true" /></Link> : <div className="d01-empty"><CalendarDays aria-hidden="true" /><p>Пробники ще не заплановано</p><span>Переглянь доступні пробні тести та підготуйся у своєму темпі.</span><Link href="/exams" className="d01-text-link">Перейти до пробників <ArrowRight aria-hidden="true" /></Link></div>}
        <Link href="/results" className="d01-results-link"><span>Мої результати<span>Збережені оцінки та історія підготовки</span></span><ArrowRight aria-hidden="true" /></Link>
      </section>
    </div>
    <nav className="d01-footer-links" aria-label="Додаткові навчальні розділи"><Link href="/analytics">Мій прогрес <ArrowRight aria-hidden="true" /></Link><Link href="/mistakes">Мої помилки <ArrowRight aria-hidden="true" /></Link><Link href="/review">Повторення <ArrowRight aria-hidden="true" /></Link></nav>
    {!user.diagnosticSkipped && !diagnosed ? <details className="d01-panel d01-diagnostic"><summary>Хочеш визначити, з чого почати?</summary><div><p>Діагностика необов’язкова. Навчатися можна й без неї.</p><DiagnosticStart /></div></details> : null}
  </div>;
}
