import Link from "next/link";
import { dateKey, formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { completeReview, reviewFlashcard, saveFlashcard } from "@/server/actions";
import { requireUser } from "@/server/session";

export default async function ReviewPage() {
  const user = await requireUser();
  const today = dateKey();
  const mine = { userId: user.id };
  const [due, overdue, upcoming, hard, history, cards, topics] = await Promise.all([
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "PENDING", dueKey: today }, include: { topic: true } }),
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "PENDING", dueKey: { lt: today } }, include: { topic: true }, orderBy: { priority: "desc" } }),
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "PENDING", dueKey: { gt: today } }, include: { topic: true }, orderBy: { dueKey: "asc" }, take: 12 }),
    prisma.topic.findMany({ where: { status: "NEEDS_REVIEW" }, take: 8 }),
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "DONE" }, include: { topic: true }, orderBy: { completedAt: "desc" }, take: 8 }),
    prisma.flashcard.findMany({ where: { userId: user.id, dueKey: { lte: today } }, take: 12 }),
    prisma.topic.findMany({ select: { id: true, subjectId: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Повторення" description="Після тематичного тесту тема повертається через 1, 7 і 30 днів. Помилка на картці підвищує пріоритет теми." />
      <Section title="Сьогодні" items={due} empty="На сьогодні повторень немає." />
      <Section title="Прострочені" items={overdue} empty="Прострочених повторень немає." />
      <Section title="Найближчі" items={upcoming} empty="Запланованих повторень далі немає." />
      <Card className="p-4">
        <h2 className="font-medium">Найскладніші теми</h2>
        {hard.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Тем зі статусом «потрібне повторення» ще немає.</p> : hard.map((topic) => <Link key={topic.id} className="mt-2 block text-sm underline" href={`/topics/${topic.id}`}>{topic.title}</Link>)}
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-medium">Картки</h2>
        {cards.length === 0 ? <p className="text-sm text-muted-foreground">Немає карт на сьогодні.</p> : cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-border p-3">
            <div className="text-xs text-muted-foreground">{card.kind}</div>
            <div className="font-medium">{card.front}</div>
            <div className="text-sm">{card.back}</div>
            <div className="mt-2 flex gap-2">
              <form action={async () => { "use server"; await reviewFlashcard(card.id, "again"); }}><button className="text-sm underline" type="submit">Повторити</button></form>
              <form action={async () => { "use server"; await reviewFlashcard(card.id, "good"); }}><button className="text-sm underline" type="submit">Знаю</button></form>
            </div>
          </div>
        ))}
        <form action={async (formData) => { "use server"; const topic = topics.find((item) => item.id === String(formData.get("topicId"))); await saveFlashcard({ topicId: topic?.id, subjectId: topic?.subjectId, kind: String(formData.get("kind") ?? "term"), front: String(formData.get("front") ?? ""), back: String(formData.get("back") ?? "") }); }} className="grid gap-2">
          <select name="topicId" className="h-10 rounded-lg border border-border bg-card px-2 text-sm">{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
          <select name="kind" className="h-10 rounded-lg border border-border bg-card px-2 text-sm"><option value="formula">Формула</option><option value="date">Дата</option><option value="person">Персоналія</option><option value="term">Термін</option><option value="rule">Правило</option></select>
          <input name="front" placeholder="Лицьовий бік" className="h-10 rounded-lg border border-border bg-card px-3 text-sm" required />
          <input name="back" placeholder="Зворотний бік" className="h-10 rounded-lg border border-border bg-card px-3 text-sm" required />
          <button className="justify-self-start rounded-lg border border-border px-3 py-2 text-sm" type="submit">Додати картку</button>
        </form>
      </Card>
      <Card className="p-4">
        <h2 className="font-medium">Історія повторень</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Історія повторень буде тут після першого проходження.</p> : history.map((item) => <p key={item.id} className="mt-2 text-sm">{item.topic.title} · {item.completedAt ? formatUk(item.completedAt) : ""}</p>)}
      </Card>
    </div>
  );
}

function Section({ title, items, empty }: { title: string; items: { id: string; topicId: string; topic: { title: string }; dueKey: string; priority: number }[]; empty: string }) {
  if (items.length === 0) return <EmptyState title={title} text={empty} />;
  return (
    <Card className="space-y-2 p-4">
      <h2 className="font-medium">{title}</h2>
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href={`/topics/${item.topicId}`} className="underline">{item.topic.title}</Link>
          <span className="text-muted-foreground">{item.dueKey}{item.priority > 1 ? " · високий пріоритет" : ""}</span>
          <form action={async () => { "use server"; await completeReview(item.id); }}><button className="underline" type="submit">Позначено</button></form>
        </div>
      ))}
    </Card>
  );
}
