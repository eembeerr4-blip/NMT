import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { CalendarDays, ClipboardList, Library, Settings2, Route } from "lucide-react";
import { Card, PageHeader, Progress, Button } from "@/components/ui";
import { ListPagination, parseListPage } from "@/components/list-pagination";
import { LearningRoute, taskStatusLabels } from "@/components/curriculum/learning-route";
import { formatUk, dateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { lessonReadiness } from "@/lib/readiness";
import { requireUser } from "@/server/session";
import { getSettings, syncPlan } from "@/server/sync";

type Mode = "personal" | "free" | "materials";

export default async function Curriculum({ searchParams }: { searchParams: Promise<{ mode?: string; page?: string; period?: string; status?: string }> }) {
  const user = await requireUser();
  const { mode: rawMode, page: rawPage, period: rawPeriod, status: rawStatus } = await searchParams;
  const mode: Mode = rawMode === "free" || rawMode === "materials" ? rawMode : "personal";
  const tabs: { mode: Mode; label: string }[] = [
    { mode: "personal", label: "Персональний маршрут" },
    { mode: "free", label: "Вільний вибір" },
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
  const period = rawPeriod === "all" ? "all" : "upcoming";
  const status = rawStatus && Object.hasOwn(taskStatusLabels, rawStatus) ? rawStatus : "";
  const where: Prisma.StudyTaskWhereInput = {
    userId: user.id,
    ...(period === "upcoming" ? { dateKey: { gte: planDate } } : {}),
    ...(status ? { status } : {}),
  };
  const pageSize = 12;
  const [total, topics, progress] = await Promise.all([
    prisma.studyTask.count({ where }),
    prisma.topic.findMany({ where: { subjectId: { in: active } }, select: { id: true, parentId: true, title: true, subjectId: true } }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id, topic: { subjectId: { in: active } } }, select: { topicId: true, status: true } }),
  ]);
  const page = Math.min(parseListPage(rawPage), Math.max(1, Math.ceil(total / pageSize)));
  const tasks = await prisma.studyTask.findMany({
    where,
    include: {
      topic: { select: { id: true, title: true, lessonJson: true, questions: { where: { verificationStatus: "VERIFIED" }, select: { id: true } }, videos: { select: { reviewStatus: true } } } },
      subject: { select: { name: true } },
    },
    orderBy: [{ dateKey: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const progressByTopic = new Map(progress.map((item) => [item.topicId, item.status]));
  const leafTopics = topics.filter((topic) => !topics.some((child) => child.parentId === topic.id));
  const counts = {
    started: leafTopics.filter((topic) => progressByTopic.get(topic.id) === "IN_PROGRESS").length,
    review: leafTopics.filter((topic) => progressByTopic.get(topic.id) === "NEEDS_REVIEW").length,
    mastered: leafTopics.filter((topic) => progressByTopic.get(topic.id) === "MASTERED").length,
    notStarted: leafTopics.filter((topic) => !progressByTopic.has(topic.id) || progressByTopic.get(topic.id) === "NOT_STARTED").length,
  };
  const percent = leafTopics.length ? Math.round(counts.mastered * 100 / leafTopics.length) : 0;

  return <PageFrame title="Мій навчальний план" description="Персональний маршрут зібраний з твого розкладу та збереженого прогресу." tabs={tabs} mode={mode}>
    <section className="d02-route-section" aria-labelledby="d02-route-title">
      <div className="d02-route-heading"><div><h2 id="d02-route-title">{period === "all" ? "Усі заняття та історія" : "Твій маршрут навчання"}</h2><p>{period === "all" ? "Збережені дати та всі статуси, зокрема перенесення й пропуски." : `Заняття від ${formatUk(planDate)}. Минулі записи доступні за весь період.`}</p></div><span>{total} занять</span></div>
      <form className="d02-filters" action="/curriculum">
        <input type="hidden" name="mode" value="personal" />
        <label>Період<select aria-label="Період" name="period" defaultValue={period}><option value="upcoming">Від початку маршруту</option><option value="all">Увесь період та історія</option></select></label>
        <label>Статус<select aria-label="Статус" name="status" defaultValue={status}><option value="">Усі статуси</option>{Object.entries(taskStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <Button type="submit" size="sm" variant="outline">Показати</Button>
      </form>
      {settings.planStart > today && period === "upcoming" ? <p className="d02-notice">План починається {formatUk(settings.planStart)}. Сьогоднішні заняття не створюємо замість майбутніх.</p> : null}
      {tasks.length ? <><LearningRoute tasks={tasks} offset={(page - 1) * pageSize} /><ListPagination page={page} total={total} pageSize={pageSize} pathname="/curriculum" params={{ mode: "personal", period, status }} /></> : <Card className="d02-empty"><Route aria-hidden="true" /><h3>За цими умовами занять немає</h3><p>Переглянь увесь період, обери тему самостійно або перевір розклад у налаштуваннях.</p><div><Link className="d02-text-link" href="/curriculum?mode=personal&period=all">Увесь збережений план</Link><Link className="d02-text-link" href="/curriculum?mode=free">Обрати тему</Link></div></Card>}
    </section>
    <details className="d02-goals"><summary>Ціль та засвоєння тем · {counts.mastered} з {leafTopics.length}</summary><div className="d02-goals-grid"><Card className="space-y-3 p-4"><h2 className="font-semibold">Ціль: {settings.targetScore} балів</h2><p className="text-sm text-muted-foreground">{settings.examDate ? `Дата іспиту: ${formatUk(settings.examDate)}` : "Дату іспиту ще не вказано."}</p><p className="text-sm">Засвоєно {counts.mastered} з {leafTopics.length} · {percent}%</p><Progress value={percent} /><p className="text-xs text-muted-foreground">Виконане заняття не означає засвоєння теми. Тут враховано збережений навчальний прогрес.</p></Card><Card className="space-y-2 p-4"><h2 className="font-semibold">Етапи підготовки</h2>{[["Ще не розпочато", counts.notStarted], ["У роботі", counts.started], ["Потребують повторення", counts.review], ["Засвоєно", counts.mastered]].map(([label, value]) => <p key={String(label)} className="flex justify-between gap-2 text-sm"><span>{label}</span><strong>{Number(value).toLocaleString("uk-UA")}</strong></p>)}</Card></div></details>
  </PageFrame>;
}

function PageFrame({ title, description, tabs, mode, children }: {
  title: string;
  description: string;
  tabs: { mode: Mode; label: string }[];
  mode: Mode;
  children: ReactNode;
}) {
  return <div className="d02-curriculum">
    <PageHeader title={title} description={description} />
    <nav className="d02-navigation" aria-label="Навігація навчального плану">
      <Link href="/curriculum?mode=personal" aria-current={mode === "personal" ? "page" : undefined}><ClipboardList aria-hidden="true" />Мій маршрут</Link>
      <Link href="/calendar"><CalendarDays aria-hidden="true" />Календар</Link>
      <Link href="/curriculum?mode=free" aria-current={mode === "free" ? "page" : undefined}><Library aria-hidden="true" />Усі теми</Link>
      <Link href="/settings"><Settings2 aria-hidden="true" />Налаштування плану</Link>
    </nav>
    <nav className="d02-modes" aria-label="Режим навчання">{tabs.map((tab) => <Link key={tab.mode} href={`/curriculum?mode=${tab.mode}`} aria-current={mode === tab.mode ? "page" : undefined}>{tab.label}</Link>)}</nav>
    {mode === "personal" ? null : <p className="d02-notice">{mode === "free" ? "Повна бібліотека предметів. Вибір теми тут не змінює твій персональний розклад." : "Редакційна готовність матеріалів — окремо від твого прогресу та доступності окремого уроку."}</p>}
    {children}
  </div>;
}
