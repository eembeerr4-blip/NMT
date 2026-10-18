import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requireAdministrator } from "@/server/session";

export const dynamic = "force-dynamic";

const testKindLabels: Record<string, string> = {
  TOPIC: "Тематичний тест",
  DIAGNOSTIC: "Діагностика",
  EXAM: "Пробник",
};

export default async function AdminTestsPage() {
  await requireAdministrator();
  const [tests, questions, verified, drafts, rejected] = await Promise.all([
    prisma.test.findMany({
      select: { id: true, title: true, kind: true, timeLimitSec: true, createdAt: true, subject: { select: { name: true } }, topic: { select: { title: true } }, _count: { select: { questions: true, attempts: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.question.count(),
    prisma.question.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.question.count({ where: { verificationStatus: "DRAFT" } }),
    prisma.question.count({ where: { verificationStatus: "REJECTED" } }),
  ]);
  return (
    <>
      <PageHeader title="Тести та завдання" description="Огляд існуючих тестів і стану банку запитань. Правила оцінювання та питання не змінюються." action={<Link href="/admin/questions" className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">Відкрити банк запитань</Link>} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Усього запитань", questions], ["Перевірено", verified], ["Очікують перевірки", drafts], ["Відхилено", rejected]].map(([label, value]) => (
          <Card key={String(label)} className="p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{Number(value).toLocaleString("uk-UA")}</div></Card>
        ))}
      </section>
      <div className="space-y-2">
        {tests.length ? tests.map((test) => (
          <Card key={test.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><div className="font-medium">{test.title}</div><div className="mt-1 text-sm text-muted-foreground">{test.subject?.name ?? "Без предмета"}{test.topic ? ` · ${test.topic.title}` : ""} · {testKindLabels[test.kind] ?? "Тест"}</div></div>
            <div className="text-right text-xs text-muted-foreground"><div>{test._count.questions} запитань · {test._count.attempts} спроб</div><div className="mt-1">{test.timeLimitSec ? `${Math.round(test.timeLimitSec / 60)} хв` : "Без таймера"}</div></div>
          </Card>
        )) : <Card className="p-5 text-sm text-muted-foreground">У базі поки немає тестів.</Card>}
      </div>
      <p className="text-xs text-muted-foreground">Показано до 100 тестів. Ключі правильних відповідей не виводяться в адміністративному огляді.</p>
    </>
  );
}
