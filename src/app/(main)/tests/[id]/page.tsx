import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, BookOpen } from "lucide-react";
import { ManualReview } from "@/components/testing/manual-review";
import { RestartTopicTest } from "@/components/testing/restart-topic-test";
import { QuestionFeedback } from "@/components/question-feedback";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MathText } from "@/components/math-text";
import { TestRunner } from "@/components/test-runner";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { learnerTestAvailable, unavailableTestMessage } from "@/lib/test-access";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const settings = await getSettings(user.id);
  const attempt = await prisma.testAttempt.findUnique({
    where: { id, userId: user.id },
    include: {
      answers: true,
      test: { include: { topic: true, subject: true, questions: { orderBy: { sortOrder: "asc" }, include: { question: { include: { topic: true, options: { orderBy: { sortOrder: "asc" } } } } } } } },
    },
  });
  if (!attempt || attempt.userId !== user.id) notFound();
  if (!learnerTestAvailable(attempt.test)) return <Card className="p-5"><h1 className="font-semibold">Матеріали тесту недоступні</h1><p>{unavailableTestMessage}</p><Button asChild variant="outline"><Link href="/tests">Мої тести</Link></Button></Card>;
  // Keep history stored, but never render withdrawn questions or their answer review.
  const lessonPractice = attempt.test.kind === "TOPIC" && Boolean(attempt.test.topicId);
  const scope = lessonPractice ? "d04f-practice d05-testing" : "d05-testing";
  const kindLabel = attempt.test.kind === "TOPIC" ? "Тематична практика" : attempt.test.kind === "EXAM" ? "Пробник" : attempt.test.kind === "DIAGNOSTIC" ? "Діагностика" : "Тест";
  const navigation = <nav className="d05-context-nav" aria-label={lessonPractice ? "Повернення до уроку" : "Навігація тестування"}><Link href={lessonPractice ? `/learn/${attempt.test.topicId}` : "/tests"}><ArrowLeft size={16} aria-hidden="true" />{lessonPractice ? "До уроку" : "Мої тести"}</Link><span>{attempt.test.subject?.name ?? "Кілька предметів"} · {lessonPractice ? attempt.status === "COMPLETED" ? "Розбір практики" : "Практика теми" : kindLabel}</span></nav>;
  if (attempt.status !== "COMPLETED") {
    const draft = JSON.parse(attempt.draftJson || "{}") as Record<string, unknown>;
    return (
      <div className={scope}>
        {navigation}
        <div className="d05-page-heading"><PageHeader title={attempt.test.title} description="Правильні відповіді приховані до завершення. Чернетка зберігається в базі й у браузері." /></div>
        <TestRunner
          key={`${user.id}:${attempt.id}`}
          userId={user.id}
          attemptId={attempt.id}
          startedAt={attempt.startedAt.toISOString()}
          timeLimitSec={attempt.test.timeLimitSec}
          timerEnabled={settings.timerEnabled}
          initialIndex={attempt.currentIndex}
          initialDraft={draft}
          questions={attempt.test.questions.map(({ question }) => ({
            id: question.id,
            type: question.type,
            difficulty: question.difficulty,
            prompt: question.prompt,
            options: question.options.map((option) => ({ id: option.id, label: option.label, text: option.text, matchKey: option.matchKey, sortOrder: option.sortOrder })),
          }))}
        />
      </div>
    );
  }
  const progress = attempt.test.topicId
    ? await prisma.userTopicProgress.findUnique({ where: { userId_topicId: { userId: user.id, topicId: attempt.test.topicId } } })
    : null;
  const config = JSON.parse(attempt.test.configJson || "{}") as { shortfall?: number; convertsToRating?: boolean };
  const percent = attempt.percent === null ? null : Math.round(attempt.percent);
  const pendingReview = Boolean(attempt.pendingCount);
  return (
    <div className={scope}>
      {navigation}
      <div className="d05-page-heading"><PageHeader title="Результат" description={attempt.test.title} /></div>
      <div className="d05-result-grid">
        <Card className="d05-score-panel">
          <div className="d05-section-heading"><h2>Ваш результат</h2><Badge>{pendingReview ? "Очікує перевірки" : "Перевірено"}</Badge></div>
          <div className="d05-score-overview">
            <div className="d05-score-ring" role="img" aria-label={percent === null ? "Відсоток не визначено" : `${percent}% правильних відповідей${pendingReview ? ", попередній результат" : ""}`} style={{"--d05-score": `${Math.min(100,Math.max(0,percent ?? 0))}%`} as CSSProperties}><div><strong>{percent === null ? "—" : `${percent}%`}</strong><span>{pendingReview ? "попередній результат" : "правильних відповідей"}</span></div></div>
            <dl className="d05-score-metrics"><div><dt>Правильні відповіді</dt><dd>{attempt.correctCount ?? "—"}/{attempt.totalCount ?? "—"}</dd></div><div><dt>Час проходження</dt><dd>{attempt.durationSec === null ? "Не записано" : `${Math.floor(attempt.durationSec/60)}:${String(attempt.durationSec%60).padStart(2,"0")}`}</dd></div>{pendingReview ? <div><dt>Очікують перевірки</dt><dd>{attempt.pendingCount}</dd></div> : null}</dl>
          </div>
          {pendingReview ? <div className="d05-notice"><CircleHelp size={18} aria-hidden="true" /><p>Відкриті відповіді очікують ручної перевірки: {attempt.pendingCount}. Їх не зараховано автоматично як помилку. Відсоток ще не остаточний.</p></div> : null}
          {attempt.test.kind !== "TOPIC" ? <p className="d05-rating-note">Це не рейтинговий бал НМТ. {config.convertsToRating ? "" : "Таблицю переведення не застосовано."}</p> : <p className="d05-rating-note">Відсоток правильних відповідей у цій спробі, а не рейтинговий бал 100–200.</p>}
        </Card>
        <Card className="d05-result-actions"><h2>Наступний крок</h2><p>Перегляньте відповіді й пояснення нижче та поверніться до навчання.</p>{attempt.test.topicId ? <><Button variant="outline" asChild><Link href={`/learn/${attempt.test.topicId}`}><BookOpen aria-hidden="true" />До уроку</Link></Button><RestartTopicTest topicId={attempt.test.topicId} /></> : <Button asChild variant="outline"><Link href={attempt.test.kind === "EXAM" ? "/exams" : "/"}>{attempt.test.kind === "EXAM" ? "До пробників" : "До навчального плану"}<ArrowRight aria-hidden="true" /></Link></Button>}<Link href="/mistakes">Журнал помилок →</Link><Link href="/tests">Усі спроби →</Link><Link href="/results">Записані результати →</Link></Card>
      </div>
      {config.shortfall ? <div className="d05-notice"><p>У банку не вистачило завдань до повного комплекту. Пропуски не заповнювались вигаданими питаннями.</p></div> : null}
      {attempt.test.kind === "DIAGNOSTIC" ? <Card className="d05-info-panel"><h2>Що означає діагностика</h2><p>Це коротка вибірка, а не оцінка всієї програми. Пропущені відповіді не означають, що тему не засвоєно.</p><p>Рекомендації оновлено за наданими неправильними відповідями. Правильна відповідь у діагностиці не позначає всю тему засвоєною.</p><Link href="/">До оновленого плану →</Link></Card> : null}
      {attempt.test.topic ? <p className="d05-topic-status">Статус теми «{attempt.test.topic.title}»: <Badge>{progress?.status === "MASTERED" ? "засвоєно" : progress?.status === "NEEDS_REVIEW" ? "потрібне закріплення" : "повторити теорію або завершити перевірку"}</Badge></p> : null}
      <section className="d05-review-list" aria-labelledby="d05-review-title"><div className="d05-section-heading"><h2 id="d05-review-title">Розбір відповідей</h2><span>{attempt.test.questions.length} завдань</span></div>
        {attempt.test.questions.map(({ question }, index) => {
          const answer = attempt.answers.find((item) => item.questionId === question.id);
          const status = answer?.needsManualReview ? "pending" : answer?.isCorrect ? "correct" : "review";
          const statusLabel = status === "pending" ? "Потрібна ручна перевірка" : status === "correct" ? "Правильно" : "Потрібно розібрати";
          return <Card key={question.id} className="d05-review-card" data-review={status}><details open><summary><span className="d05-review-number">{index + 1}</span><span>Завдання {index + 1}</span><span className="d05-review-status">{status === "correct" ? <CheckCircle2 size={16} aria-hidden="true" /> : <CircleHelp size={16} aria-hidden="true" />}{statusLabel}</span></summary><div className="d05-review-body"><MathText text={question.prompt} /><div className="d05-your-answer"><h3>Ваша відповідь</h3><MathText text={displayAnswer(answer?.userAnswer, question.options)} /></div><div className="d05-explanation"><h3>Пояснення</h3>{question.explanation?.trim() ? <MathText text={question.explanation} /> : <p>Пояснення до цього завдання ще не додано.</p>}</div>{question.source ? <p className="d05-question-source">{question.source}</p> : null}
            {answer?.needsManualReview ? <ManualReview answerId={answer.id} /> : null}
            <QuestionFeedback id={question.id} />
          </div></details></Card>;
        })}
      </section>
    </div>
  );
}

function displayAnswer(raw: string | undefined, options: { id: string; text: string }[]) {
  if (!raw) return "немає";
  let value: unknown = raw;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
  const text = new Map(options.map((option) => [option.id, option.text]));
  if (typeof value === "string") return text.get(value) ?? value;
  if (Array.isArray(value)) return value.map((id) => text.get(String(id)) ?? String(id)).join(" → ");
  if (value && typeof value === "object" && "final" in value) { const step=value as {work?:string;final?:string}; return `${step.work ? `Хід розв’язання: ${step.work}. ` : ""}Кінцева відповідь: ${step.final || "немає"}`; }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, string>).map(([left, right]) => `${text.get(left) ?? left} → ${text.get(right) ?? right}`).join("; ");
  }
  return "немає";
}
