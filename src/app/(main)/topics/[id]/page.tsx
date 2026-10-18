import Link from "next/link";
import { notFound } from "next/navigation";
import { COVERAGE_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/session";

import { MathText } from "@/components/math-text";
import { StudyLogForm } from "@/components/forms";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const topic = await prisma.topic.findUnique({
    where: { id },
    include: {
      subject: true,
      videos: { orderBy: { createdAt: "asc" }, include: { progress: { where: { userId: user.id } } } },
      notes: { where: { userId: user.id }, orderBy: { updatedAt: "desc" } },
      questions: { where: { verificationStatus: "VERIFIED" } },
      dependsOn: { include: { prerequisite: true } },
      tests: { include: { attempts: { where: { status: "COMPLETED", userId: user.id }, orderBy: { finishedAt: "desc" }, take: 5 } } },
    },
  });
  if (!topic) notFound();

  const progress = await prisma.userTopicProgress.findUnique({ where: { userId_topicId: { userId: user.id, topicId: topic.id } } });
  const learningStatus = progress?.status ?? "NOT_STARTED";
  const attempts = topic.tests.flatMap((test) => test.attempts);
  const advice = !progress?.lastTotal
    ? "Після тесту тут буде рекомендація."
    : learningStatus === "MASTERED"
      ? "Тему попередньо засвоєно."
      : learningStatus === "NEEDS_REVIEW"
        ? "Потрібне закріплення."
        : "Варто повторити теорію перед новою спробою.";
  return (
    <div className="space-y-6">
      <PageHeader title={topic.title} description={`${topic.subject.name}. ${COVERAGE_LABEL[topic.coverage] ?? ""}`} action={<Badge>{STATUS_LABEL[learningStatus]}</Badge>} />
      <Button asChild><Link href={`/learn/${topic.id}`}>Відкрити урок →</Link></Button>
      <Card className="space-y-3 p-4">
        <MathText text={topic.summary || "Короткий опис можна доповнити у конспекті."} />
        {topic.formulas ? <div><h2 className="mb-1 font-medium">Основні формули</h2><MathText text={topic.formulas} /></div> : null}
        {topic.dependsOn.length ? <p className="text-sm text-muted-foreground">Спирається на: {topic.dependsOn.map((item) => item.prerequisite.title).join(", ")}</p> : null}
        <p className="text-sm">{advice}</p>
        <StudyLogForm subjectId={topic.subjectId} topicId={topic.id} />
      </Card>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between"><h2 className="font-medium">Мої нотатки</h2><Link href="/notes" className="text-sm underline">Усі конспекти</Link></div>
        {topic.notes.length === 0 ? <p className="text-sm text-muted-foreground">Конспекта ще немає.</p> : topic.notes.map((note) => (
          <div key={note.id}><div className="font-medium">{note.title}</div><MathText text={note.content} className="text-sm" /></div>
        ))}
      </Card>
      <Card className="p-4">
        <h2 className="font-medium">Попередні результати</h2>
        {attempts.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Тестів за темою ще не завершено.</p> : (
          <div className="mt-3 space-y-2 text-sm">
            {attempts.map((attempt) => (
              <Link key={attempt.id} href={`/tests/${attempt.id}`} className="flex justify-between rounded-xl bg-muted px-3 py-2">
                <span>{attempt.finishedAt ? formatUk(attempt.finishedAt) : "Без дати"}</span>
                <span>{attempt.correctCount ?? 0}/{attempt.totalCount ?? 0}{attempt.pendingCount ? ` · на перевірці ${attempt.pendingCount}` : ""}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
