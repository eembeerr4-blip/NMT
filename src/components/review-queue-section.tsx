import Link from "next/link";
import { formatUk, parseDateKey } from "@/lib/dates";
import type { ReviewScheduleRow } from "@/lib/mistake-review-ui";
import { reviewPriorityLabel, topicHasLearnerTheory } from "@/lib/mistake-review-ui";
import { ReviewControls } from "@/components/review-controls";
import { Card, EmptyState } from "@/components/ui";

export function ReviewQueueSection({
  title,
  items,
  empty,
  mistakeCounts,
}: {
  title: string;
  items: ReviewScheduleRow[];
  empty: string;
  mistakeCounts: Map<string, number>;
}) {
  if (items.length === 0) return <EmptyState title={title} text={empty} />;
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        <span className="text-sm text-muted-foreground">{items.length}</span>
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const hasTheory = topicHasLearnerTheory(item.topic);
          const mistakeCount = mistakeCounts.get(item.topicId) ?? 0;
          const priority = reviewPriorityLabel(item.priority);
          return (
            <li key={item.id} className="rounded-xl border border-border p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">{item.topic.subject.name}</p>
                  <Link href={`/topics/${item.topicId}`} className="font-medium underline-offset-2 hover:underline">
                    {item.topic.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatUk(parseDateKey(item.dueKey))}
                    {priority ? ` · ${priority}` : ""}
                    {item.intervalDays ? ` · інтервал ${item.intervalDays} дн.` : ""}
                  </p>
                </div>
                <ReviewControls id={item.id} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/topics/${item.topicId}`} className="inline-flex min-h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
                  Картка теми
                </Link>
                {hasTheory ? (
                  <Link href={`/learn/${item.topicId}`} className="inline-flex min-h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
                    Конспект
                  </Link>
                ) : null}
                {mistakeCount > 0 ? (
                  <Link href={`/mistakes?topic=${item.topicId}`} className="inline-flex min-h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
                    Помилки ({mistakeCount})
                  </Link>
                ) : (
                  <span className="inline-flex min-h-9 items-center px-1 text-sm text-muted-foreground">Помилок за темою немає</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
