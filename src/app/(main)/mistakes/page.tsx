import Link from "next/link";
import { MathText } from "@/components/math-text";
import { MISTAKE_CATEGORY_LABEL, SUBJECTS } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MistakeControls } from "@/components/mistake-controls";
import {ListPagination,parseListPage} from "@/components/list-pagination";
import { learnerQuestionAvailable } from "@/lib/test-access";
import { requireUser } from "@/server/session";

export default async function MistakesPage({ searchParams }: { searchParams: Promise<{ subject?: string; topic?: string; category?: string; status?: string; from?: string; q?: string; page?:string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const page=parseListPage(params.page);
  const activeSubjects = user.subjects.filter((item) => item.active).map((item) => item.subjectId);
  const query = (params.q ?? "").trim().slice(0, 120);
  const category = params.category && Object.hasOwn(MISTAKE_CATEGORY_LABEL, params.category) ? params.category : "";
  const status = ["OPEN", "REVIEWING", "FIXED"].includes(params.status ?? "") ? params.status : "";
  const from = parseDateKey(params.from);
  const selectedSubject = !activeSubjects.length || activeSubjects.includes(params.subject ?? "") ? params.subject : undefined;
  const requestedTopic = params.topic ? await prisma.topic.findFirst({ where: { id: params.topic, ...(activeSubjects.length ? { subjectId: { in: activeSubjects } } : {}) }, select: { id: true } }) : null;
  // Old mistake snapshots must not expose questions withdrawn after a completed test.
  const readableQuestionIds = await prisma.question.findMany({
    where: { mistakes: { some: { userId: user.id } } }, include: { topic: true },
  }).then(rows => rows.filter(learnerQuestionAvailable).map(question => question.id));
  const where = {
    userId: user.id,
    questionId: { in: readableQuestionIds },
    ...(activeSubjects.length ? { subjectId: { in: activeSubjects } } : {}),
    ...(selectedSubject ? { subjectId: selectedSubject } : {}),
    ...(requestedTopic ? { topicId: requestedTopic.id } : params.topic ? { topicId: "__no_matching_topic__" } : {}),
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(from ? { date: { gte: new Date(`${from}T00:00:00`) } } : {}),
    ...(query ? { OR: [{ prompt: { contains: query } }, { topic: { title: { contains: query } } }] } : {}),
  };
  const [mistakes, topics, total] = await Promise.all([
    prisma.mistake.findMany({ where, include: { subject: true, topic: true }, orderBy: { date: "desc" }, take: 20, skip:(page-1)*20 }),
    prisma.topic.findMany({ where: activeSubjects.length ? { subjectId: { in: activeSubjects } } : {}, orderBy: { sortOrder: "asc" } }),
    prisma.mistake.count({where}),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Мої помилки" description="Переглядайте складні завдання, оновлюйте їхній стан і повертайтеся до теми для повторення." />
      <Card className="p-4 sm:p-5">
        <details open={Boolean(params.q||params.subject||params.topic||params.status||params.category||params.from)}><summary className="cursor-pointer font-semibold">Пошук та фільтри</summary><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(160px,1fr)_auto]">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Предмет</span><select name="subject" defaultValue={params.subject ?? ""}><option value="">Усі предмети</option>{user.subjects.filter((item) => item.active).map((item) => <option key={item.subjectId} value={item.subjectId}>{SUBJECTS.find((subject) => subject.id === item.subjectId)?.name ?? item.subjectId}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Тема</span><select name="topic" defaultValue={params.topic ?? ""}><option value="">Усі теми</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Причина</span><select name="category" defaultValue={category}><option value="">Усі причини</option>{Object.entries(MISTAKE_CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Стан</span><select name="status" defaultValue={status}><option value="">Усі стани</option><option value="OPEN">До повторення</option><option value="REVIEWING">Повторюю</option><option value="FIXED">Виправлено</option></select></label>
          <label className="grid gap-1.5 text-sm sm:col-span-2 xl:col-span-1"><span className="font-medium">Пошук</span><input name="q" defaultValue={query} placeholder="Завдання або тема" maxLength={120}/></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Починаючи з</span><input type="date" name="from" defaultValue={from ?? ""}/></label>
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-5"><button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" type="submit">Застосувати фільтри</button><Link href="/mistakes" className="inline-flex h-10 items-center rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted">Скинути</Link></div>
        </form></details>
        {params.from && !from ? <p role="alert" className="mt-3 text-sm text-danger-text">Перевірте дату. Виберіть її в календарі фільтра.</p> : null}
      </Card>
      {mistakes.length === 0 ? <EmptyState title="Помилок за цими фільтрами немає" text="Неправильні відповіді з тестів з’являтимуться тут автоматично. Поки можете повторити будь-яку тему з каталогу предметів." /> : <>
        <p className="text-sm text-muted-foreground">Показано {mistakes.length}{mistakes.length === 20 ? " останніх записів" : " помилок"}.</p>
        {mistakes.map((mistake) => (
          <Card key={mistake.id} className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-sm text-muted-foreground">{mistake.subject.name} · {formatUk(mistake.date)}</p><h2 className="mt-1 font-semibold">{mistake.topic?.title ?? "Тема не вказана"}</h2></div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{mistakeStatus(mistake.status)}</span>
            </div>
            <MathText text={mistake.prompt} className="text-sm leading-6"/>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Ваша відповідь</p><MathText text={mistake.userAnswer} className="mt-1 text-sm"/></div>
              <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Правильна відповідь</p><MathText text={mistake.correctAnswer} className="mt-1 text-sm"/></div>
            </div>
            {mistake.explanation ? <details className="text-sm"><summary className="cursor-pointer font-medium">Пояснення</summary><MathText text={mistake.explanation} className="mt-2 text-muted-foreground"/></details> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">{MISTAKE_CATEGORY_LABEL[mistake.category] ?? "Причину не вказано"} · повторень: {mistake.repeatCount}</p>
              <div className="flex flex-wrap items-center gap-2">
                {mistake.topic ? <Link href={`/topics/${mistake.topic.id}`} className="inline-flex min-h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">Повторити тему</Link> : null}
                <MistakeControls id={mistake.id} category={mistake.category} status={mistake.status}/>
              </div>
            </div>
          </Card>
        ))}
      </>}
      <ListPagination page={page} total={total} pathname="/mistakes" params={{q:query,subject:params.subject,topic:params.topic,category,status,from}}/>
    </div>
  );
}

function mistakeStatus(status: string) {
  if (status === "OPEN") return "До повторення";
  if (status === "REVIEWING") return "Повторюю";
  if (status === "FIXED") return "Виправлено";
  return status;
}

function parseDateKey(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : undefined;
}
