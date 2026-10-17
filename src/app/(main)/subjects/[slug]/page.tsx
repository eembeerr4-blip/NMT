import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUS_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { averageForSubject, changeFromInitial, formatDelta } from "@/lib/scoring";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";

export default async function SubjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id: slug },
    include: { topics: { orderBy: { sortOrder: "asc" } }, examResults: { where: { userId: user.id }, orderBy: { date: "desc" } } },
  });
  if (!subject) notFound();
  const progress = await prisma.userTopicProgress.findMany({ where: { userId: user.id, topicId: { in: subject.topics.map((topic) => topic.id) } } });
  const statusOf = new Map(progress.map((item) => [item.topicId, item]));
  const roots = subject.topics.filter((topic) => !topic.parentId);
  const points = subject.examResults.map((result) => ({
    subjectId: result.subjectId,
    date: result.date.toISOString().slice(0, 10),
    ratingScore: result.ratingScore,
    partial: result.partial,
    belowThreshold: result.belowThreshold,
    countsTowardAverage: result.countsTowardAverage,
  }));
  const average = averageForSubject(points, subject.id);
  const delta = changeFromInitial(points, subject.id);
  return (
    <div className="space-y-6">
      <PageHeader title={subject.name} description={subject.description} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-muted-foreground">Середній рейтинговий бал</div><div className="text-xl font-semibold">{average.value ?? average.label}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Зміна від першого результату</div><div className="text-xl font-semibold">{formatDelta(delta.value)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Записів результатів</div><div className="text-xl font-semibold">{subject.examResults.length}</div></Card>
      </div>
      <div className="space-y-3">
        {roots.map((topic) => {
          const children = subject.topics.filter((child) => child.parentId === topic.id);
          const rows = children.length ? children : [topic];
          return (
            <Card key={topic.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/topics/${topic.id}`} className="font-medium hover:underline">{topic.title}</Link>
                <Badge>{STATUS_LABEL[statusOf.get(topic.id)?.status ?? "NOT_STARTED"]}</Badge>
              </div>
              {children.length ? (
                <div className="mt-3 space-y-2">
                  {rows.map((child) => (
                    <Link key={child.id} href={`/topics/${child.id}`} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
                      <span>{child.title}</span>
                      <span>{STATUS_LABEL[statusOf.get(child.id)?.status ?? "NOT_STARTED"]}{statusOf.get(child.id)?.lastTotal ? ` · ${statusOf.get(child.id)?.lastCorrect}/${statusOf.get(child.id)?.lastTotal}` : ""}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
