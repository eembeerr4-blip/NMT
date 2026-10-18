import Link from "next/link";
import type { ReactNode } from "react";
import { Card, PageHeader, Progress } from "@/components/ui";
import { formatUk, dateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { lessonReadiness } from "@/lib/readiness";
import { requireUser } from "@/server/session";
import { getSettings, syncPlan } from "@/server/sync";

type Mode = "personal" | "free" | "materials";

const statusLabels: Record<string, string> = {
  PLANNED: "Заплановано",
  IN_PROGRESS: "У роботі",
  DONE: "Виконано",
  MOVED: "Перенесено",
  DROPPED: "Скасовано",
};

export default async function Curriculum({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser();
  const { mode: rawMode } = await searchParams;
  const mode: Mode = rawMode === "free" || rawMode === "materials" ? rawMode : "personal";
  const tabs: { mode: Mode; label: string }[] = [
    { mode: "personal", label: "Персональний план" },
    { mode: "free", label: "Вільне навчання" },
    { mode: "materials", label: "Готовність матеріалів" },
  ];

  if (mode === "free") {
    const subjects = await prisma.subject.findMany({
      orderBy: { sortOrder: "asc" },
      include: { topics: { select: { id: true, parentId: true, title: true, sortOrder: true } } },
    });
    return <PageFrame title="Вільне навчання" description="Обирай будь-який предмет і переходь до наявних у базі розділів та тем." tabs={tabs} mode={mode}>
      <div className="grid gap-4 lg:grid-cols-2">
        {subjects.map((subject) => {
          const roots = subject.topics.filter((topic) => !topic.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
          return <Card key={subject.id} className="space-y-3 p-5"><div className="flex items-start gap-3"><span className="mt-1 h-3 w-3 rounded-full" style={{ background: subject.color }} /><div><h2 className="font-semibold">{subject.name}</h2><p className="mt-1 text-sm text-muted-foreground">{subject.description}</p></div></div>
            {roots.length ? <div className="space-y-1">{roots.slice(0, 5).map((topic) => <Link key={topic.id} href={`/topics/${topic.id}`} className="block rounded-xl bg-muted px-3 py-2 text-sm hover:bg-accent">{topic.title}</Link>)}</div> : <p className="text-sm text-muted-foreground">Розділів ще не додано.</p>}
            <Link href={`/subjects/${subject.id}`} className="inline-flex text-sm font-medium text-primary hover:underline">Відкрити предмет →</Link>
          </Card>;
        })}
      </div>
    </PageFrame>;
  }

  if (mode === "materials") {
    const active = user.subjects.filter((item) => item.active).map((item) => item.subjectId);
    const topics = await prisma.topic.findMany({
      where: { subjectId: { in: active } },
      include: { subject: true, children: true, questions: { where: { verificationStatus: "VERIFIED" }, select: { difficulty: true } }, videos: { select: { reviewStatus: true } } },
      orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }],
    });
    return <PageFrame title="Готовність навчальних матеріалів" description="Стан конспектів, прикладів, перевіреної практики та відео в активних предметах. Це не сертифікація курсу або підтвердження програми НМТ-2027." tabs={tabs} mode={mode}>
      <div className="space-y-3">
        {topics.length ? topics.map((topic) => {
          const readiness = lessonReadiness(topic);
          return <Card className="space-y-2 p-4" key={topic.id}><div className="flex flex-wrap justify-between gap-2"><Link className="font-medium hover:text-primary" href={readiness.section ? `/topics/${topic.id}` : `/learn/${topic.id}`}>{topic.subject.name} · {topic.title}</Link><span className="text-sm text-muted-foreground">{readiness.section ? "Розділ" : readiness.ready ? "Комплект зібрано" : "Комплект неповний"}</span></div>{!readiness.section ? <p className="text-sm text-muted-foreground">Теорія {readiness.theory ? "✓" : "—"} · Приклади {readiness.examples ? "✓" : "—"} · Практика {readiness.counts.EASY}/{readiness.counts.MEDIUM}/{readiness.counts.HARD} з 4/5/3 · Відео {readiness.video ? "✓" : "—"}</p> : null}</Card>;
        }) : <Card className="p-5 text-sm text-muted-foreground">Оберіть предмети, щоб переглянути готовність матеріалів.</Card>}
      </div>
    </PageFrame>;
  }

  await syncPlan(user.id);
  const settings = await getSettings(user.id);
  const active = user.subjects.filter((item) => item.active).map((item) => item.subjectId);
  const today = dateKey();
  const planDate = today < settings.planStart ? settings.planStart : today;
  const [tasks, topics, progress] = await Promise.all([
    prisma.studyTask.findMany({
      where: { userId: user.id, dateKey: { gte: planDate }, status: { notIn: ["DROPPED", "MOVED"] } },
      include: { topic: { select: { id: true, title: true } }, subject: { select: { name: true } } },
      orderBy: [{ dateKey: "asc" }, { sortOrder: "asc" }],
      take: 30,
    }),
    prisma.topic.findMany({ where: { subjectId: { in: active } }, select: { id: true, parentId: true, title: true, subjectId: true } }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id, topic: { subjectId: { in: active } } }, select: { topicId: true, status: true } }),
  ]);
  const progressByTopic = new Map(progress.map((item) => [item.topicId, item.status]));
  const leafTopics = topics.filter((topic) => !topics.some((child) => child.parentId === topic.id));
  const counts = {
    started: leafTopics.filter((topic) => progressByTopic.get(topic.id) === "IN_PROGRESS").length,
    review: leafTopics.filter((topic) => progressByTopic.get(topic.id) === "NEEDS_REVIEW").length,
    mastered: leafTopics.filter((topic) => progressByTopic.get(topic.id) === "MASTERED").length,
    notStarted: leafTopics.filter((topic) => !progressByTopic.has(topic.id) || progressByTopic.get(topic.id) === "NOT_STARTED").length,
  };
  const percent = leafTopics.length ? Math.round(counts.mastered * 100 / leafTopics.length) : 0;
  const nextTask = tasks.find((task) => task.topicId && task.status !== "DONE");

  return <PageFrame title="Мій навчальний план" description="Персональний маршрут зібраний з твого розкладу та збереженого прогресу." tabs={tabs} mode={mode}>
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="space-y-4 border-primary/20 bg-accent/40 p-5 sm:p-6">
        <div><div className="text-sm font-medium text-primary">Поточна ціль</div><h2 className="mt-1 text-2xl font-semibold">Рейтинговий бал {settings.targetScore}</h2><p className="mt-1 text-sm text-muted-foreground">{settings.examDate ? `Дата іспиту: ${formatUk(settings.examDate)}` : "Дату іспиту ще не вказано."}</p></div>
        <div><div className="mb-2 flex justify-between text-sm"><span>Засвоєні теми</span><span>{counts.mastered} з {leafTopics.length} · {percent}%</span></div><Progress value={percent} /></div>
        <Link href={nextTask?.topicId ? `/learn/${nextTask.topicId}` : "/subjects"} className="inline-flex w-fit rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">{nextTask ? `Наступна тема: ${nextTask.topic?.title ?? nextTask.title}` : "Обрати наступну тему"}</Link>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Етапи підготовки</h2>
        {[["Ще не розпочато", counts.notStarted], ["У роботі", counts.started], ["Потребують повторення", counts.review], ["Засвоєно", counts.mastered]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between border-b border-border py-2 last:border-0"><span className="text-sm text-muted-foreground">{label}</span><span className="font-semibold">{Number(value).toLocaleString("uk-UA")}</span></div>)}
      </Card>
    </section>
    <section className="space-y-3">
      <div><h2 className="text-lg font-semibold">Навчальні задачі</h2><p className="text-sm text-muted-foreground">Наступні задачі у твоєму збереженому плані</p></div>
      {tasks.length ? <div className="space-y-2">{tasks.map((task) => <Card key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><div className="font-medium">{task.title}</div><div className="mt-1 text-sm text-muted-foreground">{formatUk(task.dateKey)} · {task.subject?.name ?? "Навчання"} · {task.durationMin} хв</div></div>
        <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{statusLabels[task.status] ?? task.status}</span>{task.topicId ? <Link href={`/learn/${task.topicId}`} className="text-sm font-medium text-primary hover:underline">До уроку →</Link> : null}</div>
      </Card>)}</div> : <Card className="p-5 text-sm text-muted-foreground">У плані поки немає наступних задач. Перевір розклад або перейди до вільного навчання.</Card>}
    </section>
  </PageFrame>;
}

function PageFrame({ title, description, tabs, mode, children }: {
  title: string;
  description: string;
  tabs: { mode: Mode; label: string }[];
  mode: Mode;
  children: ReactNode;
}) {
  return <div className="space-y-6">
    <PageHeader title={title} description={description} />
    <nav className="flex flex-wrap gap-2" aria-label="Режим навчання">{tabs.map((tab) => <Link key={tab.mode} href={tab.mode === "personal" ? "/curriculum" : `/curriculum?mode=${tab.mode}`} aria-current={mode === tab.mode ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-medium ${mode === tab.mode ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>{tab.label}</Link>)}</nav>
    {children}
  </div>;
}
