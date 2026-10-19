import Link from "next/link";
import { isAdministrator } from "@/lib/permissions";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { COVERAGE_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireContentEditor } from "@/server/session";

export const dynamic = "force-dynamic";
const pageSize = 30;

export default async function AdminTopicsPage({ searchParams }: { searchParams: Promise<{ subject?: string; q?: string; status?: string; page?: string }> }) {
  const user = await requireContentEditor();
  const base = isAdministrator(user) ? "/admin" : "/editor";
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const coverageKeys = Object.keys(COVERAGE_LABEL);
  const status = params.status && coverageKeys.includes(params.status) ? params.status : "";
  const requested = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(requested, 100000)) : 1;
  const where = {
    ...(params.subject ? { subjectId: params.subject } : {}),
    ...(status ? { coverage: status } : {}),
    ...(query ? { title: { contains: query } } : {}),
  };
  const [topics, total, subjects] = await Promise.all([
    prisma.topic.findMany({
      where,
      include: { subject: { select: { name: true } }, parent: { select: { title: true } }, _count: { select: { children: true, questions: true, videos: true } } },
      orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.topic.count({ where }),
    prisma.subject.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageUrl = (next: number) => {
    const search = new URLSearchParams({ page: String(next), ...(query ? { q: query } : {}), ...(params.subject ? { subject: params.subject } : {}), ...(status ? { status } : {}) });
    return `${base}/topics?${search}`;
  };
  return (
    <>
      <PageHeader title="Розділи та теми" description="Структура контенту: предмет → розділ → тема. Збережіть наявні зв’язки, редагуючи тему." />
      <Card className="p-4 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Пошук за назвою</span><input name="q" defaultValue={query} placeholder="Наприклад, рівняння"/></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Предмет</span><select name="subject" defaultValue={params.subject ?? ""}><option value="">Усі предмети</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Стан матеріалів</span><select name="status" defaultValue={status}><option value="">Усі стани</option>{coverageKeys.map((key) => <option key={key} value={key}>{COVERAGE_LABEL[key] ?? key}</option>)}</select></label>
          <div className="flex items-end gap-2"><Button type="submit">Знайти</Button><Button asChild variant="ghost"><Link href={`${base}/topics`}>Скинути</Link></Button></div>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">Знайдено {total.toLocaleString("uk-UA")} тем.</p>
      </Card>
      {topics.length === 0 ? <EmptyState title="Тем не знайдено" text="Змініть фільтри, щоб переглянути інші навчальні матеріали." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Предмет і тема</th><th className="px-4 py-3 font-medium">Підтеми</th><th className="px-4 py-3 font-medium">Завдання</th><th className="px-4 py-3 font-medium">Матеріали</th><th className="px-4 py-3 font-medium">Дія</th></tr></thead>
              <tbody className="divide-y divide-border">{topics.map((topic) => <tr key={topic.id} className="hover:bg-muted/30">
                <td data-label="Предмет і тема" className="px-4 py-3"><p className="text-xs text-muted-foreground">{topic.subject.name}{topic.parent ? ` · ${topic.parent.title}` : " · Розділ"}</p><p className="mt-1 font-medium">{topic.title}</p></td>
                <td data-label="Підтеми" className="px-4 py-3">{topic._count.children}</td><td data-label="Завдання" className="px-4 py-3">{topic._count.questions}</td>
                <td data-label="Матеріали" className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{COVERAGE_LABEL[topic.coverage] ?? topic.coverage}</span><span className="ml-2 text-xs text-muted-foreground">{topic._count.videos} відео</span></td>
                <td data-label="Дія" className="px-4 py-3"><Button asChild variant="outline" size="sm"><Link href={`${base}/topics/${topic.id}`}>Відкрити редактор</Link></Button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}
      <nav aria-label="Сторінки тем" className="flex items-center justify-between gap-3 text-sm"><span>Сторінка {page} із {pageCount}</span><div className="flex gap-2">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page - 1)}>Назад</Link></Button> : null}{page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page + 1)}>Далі</Link></Button> : null}</div></nav>
    </>
  );
}
