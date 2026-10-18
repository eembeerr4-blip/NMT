import Link from "next/link";
import { dateKey, formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { FlashcardForm, ReviewControls } from "@/components/review-controls";
import { requireUser } from "@/server/session";

export default async function ReviewPage() {
  const user = await requireUser();
  const today = dateKey();
  const mine = { userId: user.id };
  const [due, overdue, upcoming, hard, history, cards, topics] = await Promise.all([
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "PENDING", dueKey: today }, include: { topic: true } }),
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "PENDING", dueKey: { lt: today } }, include: { topic: true }, orderBy: { priority: "desc" } }),
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "PENDING", dueKey: { gt: today } }, include: { topic: true }, orderBy: { dueKey: "asc" }, take: 12 }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id, status: "NEEDS_REVIEW" }, include: { topic: true }, take: 8 }).then((rows) => rows.map((row) => row.topic)),
    prisma.reviewSchedule.findMany({ where: { ...mine, status: "DONE" }, include: { topic: true }, orderBy: { completedAt: "desc" }, take: 8 }),
    prisma.flashcard.findMany({ where: { userId: user.id, dueKey: { lte: today } }, take: 12 }),
    prisma.topic.findMany({ select: { id: true, subjectId: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Повторення" description="Інтервали повторення залежать від результату: 1, 7 і 30 днів для закріплення, раніше при труднощах і пізніше при впевненому результаті." />
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
            <div className="text-xs text-muted-foreground">{({formula:"Формула",date:"Дата",person:"Персоналія",term:"Термін",rule:"Правило"} as Record<string,string>)[card.kind] ?? "Картка"}</div>
            <div className="font-medium">{card.front}</div>
            <div className="text-sm">{card.back}</div>
            <div className="mt-2"><ReviewControls id={card.id} card /></div>
          </div>
        ))}
        <FlashcardForm topics={topics} />
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
          <ReviewControls id={item.id} />
        </div>
      ))}
    </Card>
  );
}
