import Link from "next/link";
import { notFound } from "next/navigation";
import { COVERAGE_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { parseLesson } from "@/lib/lesson";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";
import { CompleteLesson, LessonTutor } from "@/components/lesson-tutor";
import { MathText } from "@/components/math-text";
import { TopicActions } from "@/components/forms";
import { VideoPanel } from "@/components/video-panel";
import { Badge, Card, PageHeader, Progress } from "@/components/ui";

export default async function LessonPage({ params }: { params: Promise<{ topicId: string }> }) {
  const user = await requireUser();
  const { topicId } = await params;
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { subject: true, videos: { orderBy: { createdAt: "asc" } } },
  });
  if (!topic) notFound();
  const settings = await getSettings(user.id);
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
    ? "Домашнє завдання: до 12 перевірених питань (4 легкі, 5 середніх, 3 складні), без повторів у одній спробі."
    : verifiedCount > 0
      ? `Перевірених питань ${verifiedCount}. Сайт не дублює їх, щоб штучно набрати 12.`
      : "Перевірених завдань для цієї теми ще немає. Оцінюваний тест не запускається.";
  return (
    <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-6 xl:space-y-0">
      <div className="space-y-6">
        <PageHeader
          title={topic.title}
          description={`${topic.subject.name} · орієнтовно ${topic.estimatedMin} хв · ${COVERAGE_LABEL[topic.coverage] ?? topic.coverage}. Програма НМТ-2027 окремим наказом тут не підтверджена.`}
          action={<Badge>{STATUS_LABEL[status]}</Badge>}
        />
        <Card className="space-y-2 p-4">
          <div className="text-sm text-muted-foreground">Прогрес теми</div>
          <Progress value={status === "MASTERED" ? 100 : status === "NEEDS_REVIEW" ? 70 : status === "IN_PROGRESS" ? 40 : 0} />
          {lesson ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">{lesson.objectives.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : <p className="text-sm">{"Навчальні цілі з'являться разом із конспектом. Порожню тему не позначено готовою."}</p>}
        </Card>
        <VideoPanel topicId={topic.id} topicTitle={`${topic.subject.name} ${topic.title}`} videos={topic.videos} />
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">Конспект</h2>
          <MathText text={lesson?.theory || topic.summary || "Матеріалу ще немає."} />
          {topic.formulas ? <div><h3 className="mb-1 text-sm font-medium">Формули</h3><MathText text={topic.formulas} /></div> : null}
          {lesson?.rules.length ? <div><h3 className="mb-1 text-sm font-medium">Правила</h3><ul className="list-disc space-y-1 pl-5 text-sm">{lesson.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></div> : null}
        </Card>
        {lesson?.examples.length ? (
          <Card className="space-y-3 p-4">
            <h2 className="font-medium">Приклади</h2>
            {lesson.examples.map((example) => (
              <div key={example.task} className="rounded-xl bg-muted p-3 text-sm">
                <MathText text={example.task} />
                <MathText text={example.solution} className="mt-1 text-muted-foreground" />
              </div>
            ))}
          </Card>
        ) : null}
        {lesson ? (
          <Card className="space-y-2 p-4 text-sm">
            <h2 className="font-medium">Типові помилки</h2>
            <ul className="list-disc space-y-1 pl-5">{lesson.mistakes.map((item) => <li key={item}>{item}</li>)}</ul>
            <h2 className="pt-2 font-medium">Коротко</h2>
            <p>{lesson.summary}</p>
          </Card>
        ) : null}
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">Домашнє завдання</h2>
          <p className="text-sm text-muted-foreground">{practiceNote}</p>
          <TopicActions topicId={topic.id} hasQuestions={verifiedCount > 0} />
          {attempt ? <p className="text-sm">Останній результат: {attempt.correctCount ?? 0}/{attempt.totalCount ?? 0}{attempt.finishedAt ? ` · ${formatUk(attempt.finishedAt)}` : ""}. <Link className="underline" href={`/tests/${attempt.id}`}>Розбір</Link></p> : <p className="text-sm text-muted-foreground">{"Результат з'явиться після завершення завдання."}</p>}
          {review ? <p className="text-sm">Наступне повторення: {formatUk(review.dueKey)}.</p> : <p className="text-sm text-muted-foreground">{"Повторення з'явиться після завершення уроку або тесту."}</p>}
          <CompleteLesson topicId={topic.id} needsPractice={verifiedCount > 0} />
          {next ? <Link className="block text-sm underline" href={`/learn/${next.id}`}>Наступний урок: {next.title}</Link> : <Link className="block text-sm underline" href={`/subjects/${topic.subjectId}`}>До предмета</Link>}
        </Card>
      </div>
      <Card className="space-y-3 p-4 xl:sticky xl:top-4">
        <h2 className="font-medium">AI-репетитор</h2>
        <p className="text-sm text-muted-foreground">{settings.aiProvider === "none" ? "AI вимкнено. Урок, тест і календар від цього не залежать." : `Провайдер: ${settings.aiProvider}.`}</p>
        <LessonTutor topicId={topic.id} topicTitle={topic.title} provider={settings.aiProvider} />
      </Card>
    </div>
  );
}
