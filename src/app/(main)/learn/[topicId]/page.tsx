import Link from "next/link";
import { notFound } from "next/navigation";
import { COVERAGE_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { parseLesson } from "@/lib/lesson";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/session";
import { CompleteLesson } from "@/components/lesson-tutor";
import { MathText } from "@/components/math-text";
import { TopicActions } from "@/components/forms";
import { VideoPanel } from "@/components/video-panel";
import { Badge, Card, PageHeader, Progress } from "@/components/ui";
import { LessonTabs } from "@/components/lesson-tabs";

export default async function LessonPage({ params }: { params: Promise<{ topicId: string }> }) {
  const user = await requireUser();
  const { topicId } = await params;
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { subject: true, children: true, questions: { where: { verificationStatus: "VERIFIED" }, select: { difficulty: true } }, videos: { orderBy: { createdAt: "asc" }, include: { progress: { where: { userId: user.id } } } } },
  });
  if (!topic) notFound();
  const [progress, verifiedCount, attempt, review, siblings] = await Promise.all([
    prisma.userTopicProgress.findUnique({ where: { userId_topicId: { userId: user.id, topicId } } }),
    prisma.question.count({ where: { topicId, verificationStatus: "VERIFIED" } }),
    prisma.testAttempt.findFirst({ where: { userId: user.id, status: "COMPLETED", test: { topicId } }, orderBy: { finishedAt: "desc" } }),
    prisma.reviewSchedule.findFirst({ where: { userId: user.id, topicId, status: "PENDING" }, orderBy: { dueKey: "asc" } }),
    prisma.topic.findMany({ where: { subjectId: topic.subjectId, parentId: topic.parentId }, orderBy: { sortOrder: "asc" } }),
  ]);
  const lesson = parseLesson(topic.lessonJson);
  const status = progress?.status ?? "NOT_STARTED";
  const next = siblings.find((item) => item.sortOrder > topic.sortOrder);
  const practiceNote = verifiedCount >= 12
    ? "Закріпіть матеріал у тематичному тесті: до 12 перевірених запитань."
    : verifiedCount > 0
      ? `Для практики доступно ${verifiedCount} перевірених запитань.`
      : "Перевірених завдань для цієї теми ще немає. Оцінюваний тест не запускається.";
  return (
    <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-6 xl:space-y-0">
      <div className="space-y-6">
        <PageHeader
          title={topic.title}
          description={`${topic.subject.name} · орієнтовно ${topic.estimatedMin} хв · ${COVERAGE_LABEL[topic.coverage] ?? topic.coverage}`}
          action={<Badge>{STATUS_LABEL[status]}</Badge>}
        />
        <nav aria-label="Шлях до уроку" className="flex flex-wrap gap-2 text-sm text-muted-foreground"><Link href="/subjects">Предмети</Link><span>/</span><Link href={`/subjects/${topic.subjectId}`}>{topic.subject.name}</Link><span>/</span><span className="text-foreground">{topic.title}</span></nav>
        {topic.children.length ? <Card className="space-y-2 p-4"><h2 className="font-medium">Уроки розділу</h2>{topic.children.map(child=><Link key={child.id} className="block underline" href={"/learn/"+child.id}>{child.title}</Link>)}</Card> : null}
        <LessonTabs
          video={<VideoPanel topicId={topic.id} topicTitle={`${topic.subject.name} ${topic.title}`} canEdit={false} videos={topic.videos.map((video) => ({ ...video, notes: video.progress[0]?.notes ?? "", lastPositionSec: video.progress[0]?.lastPositionSec ?? 0 }))} />}
          notes={<div className="space-y-3">
            <Card className="space-y-3 p-4">
              <h2 className="font-semibold">Матеріал уроку</h2>
              <MathText text={lesson?.theory || topic.summary || "Матеріалу ще немає."} />
              {topic.formulas ? <div><h3 className="mb-1 text-sm font-medium">Формули</h3><MathText text={topic.formulas} /></div> : null}
              {lesson?.rules.length ? <div><h3 className="mb-1 text-sm font-medium">Правила</h3><ul className="list-disc space-y-1 pl-5 text-sm">{lesson.rules.map((rule) => <li key={rule}><MathText text={rule} /></li>)}</ul></div> : null}
            </Card>
            {lesson ? <Card className="space-y-2 p-4 text-sm"><h2 className="font-medium">Типові помилки</h2><ul className="list-disc space-y-1 pl-5">{lesson.mistakes.map((item) => <li key={item}><MathText text={item} /></li>)}</ul><h2 className="pt-2 font-medium">Коротко</h2><MathText text={lesson.summary} /></Card> : null}
            {lesson?.sources?.length ? <Card className="space-y-2 p-4 text-sm"><h2 className="font-medium">Джерела</h2>{lesson.sources.map((source) => <a key={source.url} className="block underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</Card> : null}
          </div>}
          examples={lesson?.examples.length ? <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Приклади</h2>
            {lesson.examples.map((example) => <div key={example.task} className="rounded-xl bg-muted p-3 text-sm"><MathText text={example.task} /><MathText text={example.solution} className="mt-1 text-muted-foreground" /></div>)}
          </Card> : <Card className="p-5 text-sm text-muted-foreground">Для цієї теми приклади ще не додані.</Card>}
          practice={<div className="space-y-3">
            <Card className="space-y-3 p-4">
              <h2 className="font-semibold">Практика</h2>
              <p className="text-sm text-muted-foreground">{practiceNote}</p>
              <TopicActions topicId={topic.id} hasQuestions={verifiedCount > 0} />
              {attempt ? <p className="text-sm">Останній результат: {attempt.correctCount ?? 0}/{attempt.totalCount ?? 0}{attempt.finishedAt ? ` · ${formatUk(attempt.finishedAt)}` : ""}. <Link className="underline" href={`/tests/${attempt.id}`}>Розбір</Link></p> : <p className="text-sm text-muted-foreground">{"Результат з'явиться після завершення завдання."}</p>}
              {review ? <p className="text-sm">Наступне повторення: {formatUk(review.dueKey)}.</p> : <p className="text-sm text-muted-foreground">{"Повторення з'явиться після завершення уроку або тесту."}</p>}
              {lesson?.theory.trim() && !topic.children.length ? <CompleteLesson topicId={topic.id} needsPractice={verifiedCount > 0} /> : <p className="text-sm">Завершення стане доступним після додавання матеріалу уроку.</p>}
              {next ? <Link className="block text-sm underline" href={`/learn/${next.id}`}>Наступний урок: {next.title}</Link> : <Link className="block text-sm underline" href={`/subjects/${topic.subjectId}`}>До предмета</Link>}
            </Card>
            {lesson?.sources?.length ? <p className="px-1 text-xs text-muted-foreground">Авторський навчальний матеріал NMT Academy. Не є офіційним завданням НМТ.</p> : null}
          </div>}
        />
      </div>
      <Card className="space-y-3 p-4 xl:sticky xl:top-20">
        <h2 className="font-semibold">План уроку</h2><ol className="space-y-2 text-sm text-muted-foreground"><li>1. Ознайомтеся з матеріалом</li><li>2. Перегляньте приклади</li><li>3. Закріпіть знання у практиці</li></ol><h3 className="pt-2 text-sm font-semibold">Ваш прогрес</h3>
        <Progress value={status === "MASTERED" ? 100 : status === "NEEDS_REVIEW" ? 70 : status === "IN_PROGRESS" ? 40 : 0} />
        <p className="text-sm text-muted-foreground">{STATUS_LABEL[status]}</p>
        <Link href={`/subjects/${topic.subjectId}`} className="inline-flex text-sm font-medium text-primary hover:underline">До предмета →</Link>
      </Card>
    </div>
  );
}
