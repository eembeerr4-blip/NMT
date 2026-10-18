import Link from "next/link";
import { isAdministrator } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { COVERAGE_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireContentEditor } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminTopicsPage({ searchParams }: { searchParams: Promise<{ subject?: string; q?: string }> }) {
  const user=await requireContentEditor();
  const base=isAdministrator(user)?"/admin":"/editor";
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const topics = await prisma.topic.findMany({
    where: {
      ...(params.subject ? { subjectId: params.subject } : {}),
      ...(query ? { title: { contains: query } } : {}),
    },
    include: { subject: { select: { name: true } }, parent: { select: { title: true } }, _count: { select: { children: true, questions: true } } },
    orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }],
    take: 300,
  });
  const subjects = await prisma.subject.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader title="Розділи та теми" description="Структура наявної бази: предмет → розділ → тема. Оберіть тему, щоб змінити її опис, формули або підтемі." />
      <Card className="p-4">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px_auto]">
          <input name="q" defaultValue={query} placeholder="Назва теми" aria-label="Пошук за назвою" className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
          <select name="subject" defaultValue={params.subject ?? ""} aria-label="Фільтр за предметом" className="h-10 rounded-xl border border-border bg-background px-3 text-sm"><option value="">Усі предмети</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
          <button className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Знайти</button>
        </form>
      </Card>
      <div className="space-y-2">
        {topics.length ? topics.map((topic) => (
          <Card key={topic.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{topic.subject.name}{topic.parent ? ` · ${topic.parent.title}` : " · Розділ"}</div><div className="mt-1 font-medium">{topic.title}</div></div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{topic._count.children} підтем</span><span>{topic._count.questions} завдань</span><span>{COVERAGE_LABEL[topic.coverage] ?? topic.coverage}</span><Link href={`${base}/topics/${topic.id}`} className="font-medium text-primary hover:underline">Редагувати тему</Link></div>
          </Card>
        )) : <Card className="p-5 text-sm text-muted-foreground">За цими параметрами тем не знайдено.</Card>}
      </div>
      <p className="text-xs text-muted-foreground">Показано до 300 записів; для уточнення скористайтеся пошуком і фільтром предмета.</p>
    </>
  );
}
