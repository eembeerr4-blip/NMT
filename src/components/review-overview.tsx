import Link from "next/link";
import { formatUk, parseDateKey } from "@/lib/dates";
import type { ReviewOverview } from "@/lib/mistake-review-ui";
import { Card, Stat } from "@/components/ui";

export function ReviewOverviewPanel({ overview, mistakeCounts }: { overview: ReviewOverview; mistakeCounts: Map<string, number> }) {
  const nextLabel = overview.nextDueKey ? formatUk(parseDateKey(overview.nextDueKey)) : "Немає запланованих";
  return (
    <section className="space-y-4" aria-label="Огляд повторень">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Прострочені" value={overview.overdueCount} description="Потребують уваги першими" />
        <Stat label="На сьогодні" value={overview.todayCount} description="Заплановані на поточний день" />
        <Stat label="Наступне повторення" value={nextLabel} description={overview.nextDueKey ? overview.nextDueKey : "Черга порожня"} />
      </div>
      {overview.attentionTopics.length ? (
        <Card className="space-y-3 p-4 sm:p-5">
          <h2 className="font-medium">Теми, що потребують підвищеної уваги</h2>
          <ul className="space-y-2">
            {overview.attentionTopics.map((topic) => (
              <li key={topic.topicId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/topics/${topic.topicId}`} className="font-medium underline-offset-2 hover:underline">
                    {topic.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    · {topic.subjectName} · {topic.reason}
                  </span>
                </div>
                {(mistakeCounts.get(topic.topicId) ?? 0) > 0 ? (
                  <Link href={`/mistakes?topic=${topic.topicId}`} className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline">
                    Помилки ({mistakeCounts.get(topic.topicId)})
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
