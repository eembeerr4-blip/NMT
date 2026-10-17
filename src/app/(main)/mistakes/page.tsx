import Link from "next/link";
import { MISTAKE_CATEGORY_LABEL, SUBJECTS } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { recommendTopics } from "@/lib/recommend";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { setMistakeMeta } from "@/server/actions";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function MistakesPage({ searchParams }: { searchParams: Promise<{ subject?: string; topic?: string; category?: string; from?: string; q?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const where = {
    userId: user.id,
    ...(params.subject ? { subjectId: params.subject } : {}),
    ...(params.topic ? { topicId: params.topic } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.from ? { date: { gte: new Date(`${params.from}T00:00:00`) } } : {}),
    ...(params.q ? { prompt: { contains: params.q } } : {}),
  };
  const [mistakes, topics, settings] = await Promise.all([
    prisma.mistake.findMany({ where, include: { subject: true, topic: true }, orderBy: { date: "desc" }, take: 50 }),
    prisma.topic.findMany(),
    getSettings(user.id),
  ]);
  const counts = new Map<string, number>();
  for (const mistake of mistakes) if (mistake.topicId) counts.set(mistake.topicId, (counts.get(mistake.topicId) ?? 0) + mistake.repeatCount);
  const recommendations = recommendTopics(topics.filter((topic) => !topics.some((child) => child.parentId === topic.id)).map((topic) => ({ ...topic, mistakeCount: counts.get(topic.id) ?? 0 })), {
    math: settings.mathPriority, ukrainian: settings.ukrainianPriority, history: settings.historyPriority, biology: settings.biologyPriority,
  }, 3);
  return (
    <div className="space-y-6">
      <PageHeader title="Журнал помилок" description="Повторна помилка в тому самому завданні збільшує лічильник, а не створює нескінченні дублікати." />
      <form className="grid gap-2 sm:grid-cols-4">
        <select name="subject" defaultValue={params.subject ?? ""} className="h-10 rounded-lg border border-border bg-card px-2 text-sm"><option value="">Усі предмети</option>{SUBJECTS.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
        <select name="topic" defaultValue={params.topic ?? ""} className="h-10 rounded-lg border border-border bg-card px-2 text-sm"><option value="">Усі теми</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
        <select name="category" defaultValue={params.category ?? ""} className="h-10 rounded-lg border border-border bg-card px-2 text-sm"><option value="">Усі категорії</option>{Object.entries(MISTAKE_CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <input type="date" name="from" defaultValue={params.from ?? ""} className="h-10 rounded-lg border border-border bg-card px-2 text-sm" />
        <button className="rounded-lg border border-border px-3 text-sm sm:col-span-4" type="submit">Фільтрувати</button>
      </form>
      <Card className="p-4">
        <h2 className="font-medium">Що повторити наступним</h2>
        {recommendations.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Поки немає відкритих помилок для рекомендації.</p> : recommendations.map((topic) => <Link key={topic.id} href={`/topics/${topic.id}`} className="mt-2 block text-sm underline">{topic.title} — {topic.reason}</Link>)}
      </Card>
      {mistakes.length === 0 ? <EmptyState title="Помилок за фільтром немає" text="Після тематичного тесту неправильні закриті відповіді потраплять сюди." /> : mistakes.map((mistake) => (
        <Card key={mistake.id} className="space-y-2 p-4 text-sm">
          <div className="font-medium">{mistake.subject.name} · {mistake.topic?.title ?? "Без теми"} · {formatUk(mistake.date)}</div>
          <p>{mistake.prompt}</p>
          <p>Ваша відповідь: {mistake.userAnswer}</p>
          <p>Правильно: {mistake.correctAnswer}</p>
          <p className="text-muted-foreground">{mistake.explanation}</p>
          <p>Повторів: {mistake.repeatCount}</p>
          <form action={async (formData) => { "use server"; await setMistakeMeta(mistake.id, String(formData.get("category")), String(formData.get("status"))); }} className="flex flex-wrap gap-2">
            <select name="category" defaultValue={mistake.category} className="h-9 rounded-lg border border-border bg-card px-2">{Object.entries(MISTAKE_CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            <select name="status" defaultValue={mistake.status} className="h-9 rounded-lg border border-border bg-card px-2"><option value="OPEN">Відкрита</option><option value="REVIEWING">Повторюю</option><option value="FIXED">Виправлено</option></select>
            <button className="text-sm underline" type="submit">Зберегти</button>
          </form>
        </Card>
      ))}
    </div>
  );
}
