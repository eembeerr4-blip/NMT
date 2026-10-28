import Link from "next/link";
import { dateKey, formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { FlashcardForm, ReviewControls } from "@/components/review-controls";
import { ReviewOverviewPanel } from "@/components/review-overview";
import { ReviewQueueSection } from "@/components/review-queue-section";
import {
  learnerReviewTopicFilter,
  loadActiveMistakeCountsForTopics,
  loadReadableMistakeQuestionIds,
  loadReviewOverview,
  mergeReviewTopicIds,
} from "@/lib/mistake-review-ui";
import { requireUser } from "@/server/session";

const reviewInclude = {
  topic: {
    include: {
      subject: true,
      videos: { select: { reviewStatus: true } },
    },
  },
} as const;

export default async function ReviewPage() {
  const user = await requireUser();
  const today = dateKey();
  const activeSubjects = user.subjects.filter((item) => item.active).map((item) => item.subjectId);
  const mistakeScope = {
    userId: user.id,
    activeSubjectIds: activeSubjects,
    readableQuestionIds: await loadReadableMistakeQuestionIds(prisma, user.id),
  };
  const mine = { userId: user.id, topic: learnerReviewTopicFilter };
  const pending = { ...mine, status: "PENDING" as const };
  const [overdue, due, upcoming, hard, history, cards, topics, overview] = await Promise.all([
    prisma.reviewSchedule.findMany({ where: { ...pending, dueKey: { lt: today } }, include: reviewInclude, orderBy: [{ priority: "desc" }, { dueKey: "asc" }] }),
    prisma.reviewSchedule.findMany({ where: { ...pending, dueKey: today }, include: reviewInclude, orderBy: { priority: "desc" } }),
    prisma.reviewSchedule.findMany({ where: { ...pending, dueKey: { gt: today } }, include: reviewInclude, orderBy: { dueKey: "asc" }, take: 12 }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id, status: "NEEDS_REVIEW", topic: learnerReviewTopicFilter }, include: { topic: true }, take: 8 }).then((rows) => rows.map((row) => row.topic)),
    prisma.reviewSchedule.findMany({ where: { userId: user.id, status: "DONE" }, include: { topic: true }, orderBy: { completedAt: "desc" }, take: 8 }),
    prisma.flashcard.findMany({ where: { userId: user.id, dueKey: { lte: today }, OR: [{topicId:null},{topic:learnerReviewTopicFilter}] }, take: 12 }),
    prisma.topic.findMany({ where: { coverage: { not: "DRAFT" } }, select: { id: true, subjectId: true, title: true }, orderBy: { title: "asc" } }),
    loadReviewOverview(prisma, user.id, today),
  ]);
  const topicIds = mergeReviewTopicIds([...overdue, ...due, ...upcoming, ...overview.attentionTopics.map((item) => ({ topicId: item.topicId }))]);
  const mistakeCounts = await loadActiveMistakeCountsForTopics(prisma, mistakeScope, topicIds);
  return (
    <div className="space-y-6">
      <PageHeader title="Повторення" description="Інтервали повторення залежать від результату: 1, 7 і 30 днів для закріплення, раніше при труднощах і пізніше при впевненому результаті." />
      <ReviewOverviewPanel overview={overview} mistakeCounts={mistakeCounts} />
      <ReviewQueueSection title="Прострочені" items={overdue} empty="Прострочених повторень немає." mistakeCounts={mistakeCounts} />
      <ReviewQueueSection title="Сьогодні" items={due} empty="На сьогодні повторень немає." mistakeCounts={mistakeCounts} />
      <ReviewQueueSection title="Найближчі" items={upcoming} empty="Запланованих повторень далі немає." mistakeCounts={mistakeCounts} />
      <Card className="p-4 sm:p-5">
        <h2 className="font-medium">Найскладніші теми</h2>
        {hard.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Тем зі статусом «потрібне повторення» ще немає.</p> : hard.map((topic) => (
          <div key={topic.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Link className="underline" href={`/topics/${topic.id}`}>{topic.title}</Link>
            {(mistakeCounts.get(topic.id) ?? 0) > 0 ? <Link href={`/mistakes?topic=${topic.id}`} className="text-primary underline-offset-2 hover:underline">Помилки ({mistakeCounts.get(topic.id)})</Link> : null}
          </div>
        ))}
      </Card>
      <Card className="space-y-3 p-4 sm:p-5">
        <h2 className="font-medium">Картки</h2>
        {cards.length === 0 ? <p className="text-sm text-muted-foreground">Немає карт на сьогодні.</p> : cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-border p-3">
            <div className="text-xs text-muted-foreground">{({formula:"Формула",date:"Дата",person:"Персоналія",term:"Термін",rule:"Правило"} as Record<string,string>)[card.kind] ?? "Картка"}</div>
            <div className="break-words font-medium">{card.front}</div>
            <div className="break-words text-sm">{card.back}</div>
            <div className="mt-2"><ReviewControls id={card.id} card /></div>
          </div>
        ))}
        <FlashcardForm topics={topics} />
      </Card>
      <Card className="p-4 sm:p-5">
        <h2 className="font-medium">Історія повторень</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Історія повторень буде тут після першого проходження.</p> : history.map((item) => <p key={item.id} className="mt-2 text-sm">{item.topic.title} · {item.completedAt ? formatUk(item.completedAt) : ""}</p>)}
      </Card>
    </div>
  );
}
