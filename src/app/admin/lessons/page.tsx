import Link from "next/link";
import { isAdministrator } from "@/lib/permissions";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { COVERAGE_LABEL } from "@/lib/constants";
import { parseLesson } from "@/lib/lesson";
import { prisma } from "@/lib/prisma";
import { requireContentEditor } from "@/server/session";

export const dynamic = "force-dynamic";
const pageSize = 30;

export default async function AdminLessonsPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; status?: string; page?: string }> }) {
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
    ...(query ? { AND: [{ title: { contains: query } }] } : {}),
  };
  const [topics, total, subjects, lessonCount, descriptionCount, videoCount] = await Promise.all([
    prisma.topic.findMany({
      where,
      select: {
        id: true, title: true, lessonJson: true, summary: true, coverage: true,
        subject: { select: { name: true } },
        videos: { select: { id: true, reviewStatus: true } },
        _count: { select: { questions: true } },
      },
      orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.topic.count({ where }),
    prisma.subject.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.topic.count({ where: { lessonJson: { not: "" } } }),
    prisma.topic.count({ where: { summary: { not: "" } } }),
    prisma.videoLesson.count(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageUrl = (next: number) => `${base}/lessons?${new URLSearchParams({ page: String(next), ...(query ? { q: query } : {}), ...(params.subject ? { subject: params.subject } : {}), ...(status ? { status } : {}) })}`;
  return (
    <>
      <PageHeader title="Уроки" description="Переглядайте готовність уроків і відкривайте редактор або попередній перегляд для учня." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Матеріали уроків" value={lessonCount}/>
        <Metric label="Теми з описом" value={descriptionCount}/>
        <Metric label="Відеоматеріали" value={videoCount}/>
      </div>
      <Card className="space-y-4 p-4 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Пошук за назвою</span><input name="q" defaultValue={query} placeholder="Назва уроку"/></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Предмет</span><select name="subject" defaultValue={params.subject ?? ""}><option value="">Усі предмети</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Готовність</span><select name="status" defaultValue={status}><option value="">Усі стани</option>{coverageKeys.map((key) => <option key={key} value={key}>{COVERAGE_LABEL[key] ?? key}</option>)}</select></label>
          <div className="flex items-end gap-2"><Button type="submit">Знайти</Button><Button asChild variant="ghost"><Link href={`${base}/lessons`}>Скинути</Link></Button></div>
        </form>
        <p className="text-sm text-muted-foreground">Знайдено {total.toLocaleString("uk-UA")} тем.</p>
      </Card>
      {topics.length === 0 ? <EmptyState title="Уроків за цими фільтрами не знайдено" text="Змініть пошук або фільтри предмета та готовності." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Предмет і тема</th><th className="px-4 py-3 font-medium">Матеріал</th><th className="px-4 py-3 font-medium">Навчальні ресурси</th><th className="px-4 py-3 font-medium">Готовність</th><th className="px-4 py-3 font-medium">Дії</th></tr></thead>
              <tbody className="divide-y divide-border">{topics.map((topic) => {
                const lesson = parseLesson(topic.lessonJson);
                return <tr key={topic.id} className="hover:bg-muted/30">
                  <td data-label="Предмет і тема" className="px-4 py-3"><p className="text-xs text-muted-foreground">{topic.subject.name}</p><p className="mt-1 font-medium">{topic.title}</p></td>
                  <td data-label="Матеріал" className="px-4 py-3">{lesson ? "Конспект готовий" : topic.summary.trim() ? "Є опис теми" : "Матеріал відсутній"}</td>
                  <td data-label="Навчальні ресурси" className="px-4 py-3 text-muted-foreground">{lesson?.examples.length ?? 0} прикладів · {topic._count.questions} завдань · {topic.videos.length} відео</td>
                  <td data-label="Готовність" className="px-4 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{COVERAGE_LABEL[topic.coverage] ?? topic.coverage}</span></td>
                  <td data-label="Дії" className="px-4 py-3"><div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`${base}/lessons/${topic.id}`}>Редактор</Link></Button><Button asChild variant="ghost" size="sm"><Link href={`/learn/${topic.id}`}>Як учень</Link></Button></div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Card>
      )}
      <nav aria-label="Сторінки уроків" className="flex items-center justify-between gap-3 text-sm"><span>Сторінка {page} із {pageCount}</span><div className="flex gap-2">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page - 1)}>Назад</Link></Button> : null}{page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page + 1)}>Далі</Link></Button> : null}</div></nav>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value.toLocaleString("uk-UA")}</p></Card>;
}
