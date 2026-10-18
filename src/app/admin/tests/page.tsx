import { Card, EmptyState, PageHeader, Button } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireAdministrator } from "@/server/session";

export const dynamic = "force-dynamic";
const pageSize = 20;
const testKindLabels: Record<string, string> = { TOPIC: "Тематичний тест", DIAGNOSTIC: "Діагностика", EXAM: "Пробник" };

export default async function AdminTestsPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; kind?: string; page?: string }> }) {
  await requireAdministrator();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const kind = ["TOPIC", "DIAGNOSTIC", "EXAM"].includes(params.kind ?? "") ? params.kind : "";
  const requested = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(requested, 100000)) : 1;
  const where = {
    ...(params.subject ? { subjectId: params.subject } : {}),
    ...(kind ? { kind } : {}),
    ...(query ? { title: { contains: query } } : {}),
  };
  const [tests, total, questions, verified, drafts, rejected, subjects] = await Promise.all([
    prisma.test.findMany({
      where,
      select: { id: true, title: true, kind: true, timeLimitSec: true, createdAt: true, subject: { select: { name: true } }, topic: { select: { title: true } }, _count: { select: { questions: true, attempts: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.test.count({ where }),
    prisma.question.count(),
    prisma.question.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.question.count({ where: { verificationStatus: { in: ["DRAFT", "PENDING_REVIEW"] } } }),
    prisma.question.count({ where: { verificationStatus: "REJECTED" } }),
    prisma.subject.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageUrl = (next: number) => `/admin/tests?${new URLSearchParams({ page: String(next), ...(query ? { q: query } : {}), ...(params.subject ? { subject: params.subject } : {}), ...(kind ? { kind } : {}) })}`;
  return (
    <>
      <PageHeader title="Тести та запитання" description="Керуйте перевіркою банку й переглядайте наявні тести. Зміни правил оцінювання не виконуються." action={<Button asChild variant="outline"><Link href="/admin/questions">Відкрити банк запитань</Link></Button>} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Усього запитань", questions], ["Перевірено", verified], ["Очікують перевірки", drafts], ["Архівовано", rejected]].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{Number(value).toLocaleString("uk-UA")}</p></Card>)}</section>
      <Card className="space-y-4 p-4 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Пошук за назвою</span><input name="q" defaultValue={query} placeholder="Назва тесту"/></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Предмет</span><select name="subject" defaultValue={params.subject ?? ""}><option value="">Усі предмети</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Тип тесту</span><select name="kind" defaultValue={kind}><option value="">Усі типи</option>{Object.entries(testKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="flex items-end gap-2"><Button type="submit">Знайти</Button><Button asChild variant="ghost"><Link href="/admin/tests">Скинути</Link></Button></div>
        </form>
        <p className="text-sm text-muted-foreground">Знайдено {total.toLocaleString("uk-UA")} тестів.</p>
      </Card>
      {tests.length === 0 ? <EmptyState title="Тестів не знайдено" text="Змініть фільтри, щоб переглянути інші наявні тести." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Тест</th><th className="px-4 py-3 font-medium">Предмет і тема</th><th className="px-4 py-3 font-medium">Склад</th><th className="px-4 py-3 font-medium">Час</th><th className="px-4 py-3 font-medium">Дія</th></tr></thead>
              <tbody className="divide-y divide-border">{tests.map((test) => <tr key={test.id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><p className="font-medium">{test.title}</p><p className="mt-1 text-xs text-muted-foreground">{testKindLabels[test.kind] ?? "Тест"}</p></td>
                <td className="px-4 py-3 text-muted-foreground">{test.subject?.name ?? "Без предмета"}{test.topic ? ` · ${test.topic.title}` : ""}</td>
                <td className="px-4 py-3">{test._count.questions} запитань · {test._count.attempts} спроб</td>
                <td className="px-4 py-3 text-muted-foreground">{test.timeLimitSec ? `${Math.round(test.timeLimitSec / 60)} хв` : "Без таймера"}</td>
                <td className="px-4 py-3"><Button asChild variant="outline" size="sm"><Link href={`/tests/${test.id}`}>Переглянути як учень</Link></Button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-sm text-muted-foreground">Для тестів ще не реалізовані безпечні дії зміни параметрів або архівації. Тут доступний перегляд; повне керування не імітується.</p>
      <nav aria-label="Сторінки тестів" className="flex items-center justify-between gap-3 text-sm"><span>Сторінка {page} із {pageCount}</span><div className="flex gap-2">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page - 1)}>Назад</Link></Button> : null}{page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page + 1)}>Далі</Link></Button> : null}</div></nav>
    </>
  );
}
