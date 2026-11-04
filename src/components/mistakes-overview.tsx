import Link from "next/link";
import type { MistakeStatusOverview } from "@/lib/mistake-review-ui";
import { Card, Stat } from "@/components/ui";

export function MistakesOverview({ overview, pendingReviewTopics }: { overview: MistakeStatusOverview; pendingReviewTopics: number }) {
  const active = overview.open + overview.reviewing;
  return (
    <section className="space-y-4" aria-label="Огляд помилок">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Відкриті помилки" value={overview.open} description="Стан «до повторення»" />
        <Stat label="Зараз повторюю" value={overview.reviewing} description="Помилки в роботі" />
        <Stat label="Виправлено" value={overview.fixed} description="Успішно закриті" />
        <Stat label="Актуальні загалом" value={active} description={pendingReviewTopics ? `У ${pendingReviewTopics} тем заплановано повторення` : "Без запланованих повторень"} />
      </div>
      {overview.topTopics.length ? (
        <Card className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Теми з найбільшою кількістю актуальних помилок</h2>
            {pendingReviewTopics ? (
              <Link href="/review" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
                Перейти до повторень
              </Link>
            ) : null}
          </div>
          <ul className="space-y-2">
            {overview.topTopics.map((topic) => (
              <li key={topic.topicId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/mistakes?topic=${topic.topicId}`} className="font-medium underline-offset-2 hover:underline">
                    {topic.title}
                  </Link>
                  {topic.subjectName ? <span className="text-muted-foreground"> · {topic.subjectName}</span> : null}
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">{topic.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : active === 0 && overview.fixed === 0 ? null : (
        <Card className="p-4 text-sm text-muted-foreground">Актуальних помилок за темами зараз немає — усі записи виправлено або відфільтровано.</Card>
      )}
    </section>
  );
}
