import Link from "next/link";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/server/session";
import { ukLessonCount } from "@/lib/uk-plural";

export const dynamic = "force-dynamic";

const pageSize = 30;
const statuses = [
  { value: "PLANNED", label: "Заплановано" },
  { value: "IN_PROGRESS", label: "У роботі" },
  { value: "DONE", label: "Виконано" },
  { value: "MOVED", label: "Перенесено" },
  { value: "DROPPED", label: "Скасовано" },
  { value: "SKIPPED", label: "Пропущено" },
];

export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; subject?: string; page?: string }> }) {
  await requireAdministrator();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const status = statuses.some((item) => item.value === params.status) ? params.status! : "";
  const requested = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(requested, 100000)) : 1;
  const where = {
    ...(status ? { status } : {}),
    ...(params.subject ? { subjectId: params.subject } : {}),
    ...(query ? { OR: [{ title: { contains: query } }, { topic: { title: { contains: query } } }] } : {}),
  };
  const [counts, tasks, total, subjects] = await Promise.all([
    Promise.all(statuses.map(async (item) => ({ ...item, count: await prisma.studyTask.count({ where: { status: item.value } }) }))),
    prisma.studyTask.findMany({
      where,
      select: { id: true, title: true, dateKey: true, kind: true, status: true, durationMin: true, subject: { select: { name: true } }, topic: { select: { title: true } } },
      orderBy: [{ dateKey: "desc" }, { sortOrder: "asc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.studyTask.count({ where }),
    prisma.subject.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageUrl = (next: number) => `/admin/tasks?${new URLSearchParams({ page: String(next), ...(query ? { q: query } : {}), ...(status ? { status } : {}), ...(params.subject ? { subject: params.subject } : {}) })}`;
  return (
    <>
      <PageHeader title="Персональні навчальні плани" description="Перегляд агрегованих занять із планів учнів. Імена, нікнейми й особисті нотатки не відображаються; редагування чужого плану недоступне." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{counts.map((item) => <Card key={item.value} className="p-4"><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold">{item.count.toLocaleString("uk-UA")}</p></Card>)}</section>
      <Card className="space-y-4 p-4 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Пошук заняття або теми</span><input name="q" defaultValue={query} placeholder="Назва заняття"/></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Статус</span><select name="status" defaultValue={status}><option value="">Усі статуси</option>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Предмет</span><select name="subject" defaultValue={params.subject ?? ""}><option value="">Усі предмети</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <div className="flex items-end gap-2"><Button type="submit">Знайти</Button><Button asChild variant="ghost"><Link href="/admin/tasks">Скинути</Link></Button></div>
        </form>
        <p className="text-sm text-muted-foreground">За фільтром знайдено {ukLessonCount(total)}.</p>
      </Card>
      {tasks.length === 0 ? <EmptyState title="Занять за фільтрами не знайдено" text="Спробуйте інший пошук або статус." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Заняття</th><th className="px-4 py-3 font-medium">Предмет і тема</th><th className="px-4 py-3 font-medium">Дата й тривалість</th><th className="px-4 py-3 font-medium">Статус</th></tr></thead>
              <tbody className="divide-y divide-border">{tasks.map((task) => <tr key={task.id} className="hover:bg-muted/30">
                <td data-label="Заняття" className="px-4 py-3 font-medium">{task.title}<p className="mt-1 text-xs font-normal text-muted-foreground">{taskKindLabels[task.kind] ?? "Навчання"}</p></td>
                <td data-label="Предмет і тема" className="px-4 py-3 text-muted-foreground">{task.subject?.name ?? "Без предмета"}{task.topic ? ` · ${task.topic.title}` : ""}</td>
                <td data-label="Дата й тривалість" className="px-4 py-3 text-muted-foreground">{formatUk(task.dateKey)} · {task.durationMin} хв</td>
                <td data-label="Статус" className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{taskStatusLabels[task.status] ?? task.status}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}
      <nav aria-label="Сторінки навчальних задач" className="flex items-center justify-between gap-3 text-sm"><span>Сторінка {page} із {pageCount}</span><div className="flex gap-2">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page - 1)}>Назад</Link></Button> : null}{page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page + 1)}>Далі</Link></Button> : null}</div></nav>
    </>
  );
}

const taskStatusLabels: Record<string, string> = Object.fromEntries(statuses.map((item) => [item.value, item.label]));
const taskKindLabels: Record<string, string> = { study: "Навчання", mock: "Пробник", analysis: "Аналіз помилок", rest: "Відпочинок", review: "Повторення", custom: "Власне заняття" };
