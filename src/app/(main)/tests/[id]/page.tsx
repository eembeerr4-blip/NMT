import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MathText } from "@/components/math-text";
import { TestRunner } from "@/components/test-runner";
import { Badge, Card, PageHeader } from "@/components/ui";
import { gradeManually, reportQuestion, startTopicTest } from "@/server/actions";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const settings = await getSettings(user.id);
  const attempt = await prisma.testAttempt.findUnique({
    where: { id },
    include: {
      answers: true,
      test: { include: { topic: true, subject: true, questions: { orderBy: { sortOrder: "asc" }, include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } } } } },
    },
  });
  if (!attempt || attempt.userId !== user.id) notFound();
  if (attempt.status !== "COMPLETED") {
    const draft = JSON.parse(attempt.draftJson || "{}") as Record<string, unknown>;
    return (
      <div className="space-y-4">
        <PageHeader title={attempt.test.title} description="Правильні відповіді приховані до завершення. Чернетка зберігається в базі й у браузері." />
        <TestRunner
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
  const config = JSON.parse(attempt.test.configJson || "{}") as { shortfall?: number; convertsToRating?: boolean };
  return (
    <div className="space-y-4">
      <PageHeader title="Результат" description={attempt.test.title} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-muted-foreground">Правильні</div><div className="text-2xl font-semibold">{attempt.correctCount}/{attempt.totalCount}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Відсоток</div><div className="text-2xl font-semibold">{Math.round(attempt.percent ?? 0)}%</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Час</div><div className="text-2xl font-semibold">{Math.max(1, Math.round((attempt.durationSec ?? 0) / 60))} хв</div></Card>
      </div>
      {attempt.pendingCount ? <Card className="p-4 text-sm">Відкриті відповіді очікують ручної перевірки: {attempt.pendingCount}. Їх не зараховано автоматично як помилку.</Card> : null}
      {config.shortfall ? <Card className="p-4 text-sm">У банку не вистачило завдань до повного комплекту. Пропуски не заповнювались вигаданими питаннями.</Card> : null}
      {attempt.test.kind !== "TOPIC" ? <Card className="p-4 text-sm">Це не рейтинговий бал НМТ. {config.convertsToRating ? "" : "Таблицю переведення не застосовано."}</Card> : null}
      {attempt.test.topic ? <p className="text-sm">Статус теми «{attempt.test.topic.title}»: <Badge>{attempt.test.topic.status === "MASTERED" ? "засвоєно" : attempt.test.topic.status === "NEEDS_REVIEW" ? "потрібне закріплення" : "повторити теорію або завершити перевірку"}</Badge></p> : null}
      <div className="space-y-3">
        {attempt.test.questions.map(({ question }, index) => {
          const answer = attempt.answers.find((item) => item.questionId === question.id);
          return (
            <Card key={question.id} className="space-y-2 p-4">
              <div className="text-sm text-muted-foreground">Завдання {index + 1}</div>
              <MathText text={question.prompt} />
              <p className="text-sm">Ваша відповідь: {displayAnswer(answer?.userAnswer, question.options)}</p>
              <p className="text-sm">{answer?.needsManualReview ? "Потрібна ручна перевірка" : answer?.isCorrect ? "Правильно" : "Потрібно розібрати"}</p>
              <MathText text={question.explanation} className="text-sm" />
              <p className="text-xs text-muted-foreground">{question.source}</p>
              {answer?.needsManualReview ? (
                <div className="flex gap-2">
                  <form action={async () => { "use server"; await gradeManually(answer.id, true); }}><button className="text-sm underline" type="submit">Зарахувати</button></form>
                  <form action={async () => { "use server"; await gradeManually(answer.id, false); }}><button className="text-sm underline" type="submit">Не зарахувати</button></form>
                </div>
              ) : null}
              <form action={async (formData) => { "use server"; await reportQuestion(question.id, String(formData.get("issue") ?? "")); }} className="flex gap-2">
                <input name="issue" placeholder="Повідомити про помилку в завданні" className="h-9 flex-1 rounded-lg border border-border bg-card px-2 text-sm" />
                <button className="text-sm underline" type="submit">Надіслати</button>
              </form>
            </Card>
          );
        })}
      </div>
      {attempt.test.topicId ? (
        <form action={async () => { "use server"; await startTopicTest(attempt.test.topicId!); }}>
          <button className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">Пройти новий варіант</button>
        </form>
      ) : null}
      <Link href="/mistakes" className="block text-sm underline">Журнал помилок</Link>
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
  if (value && typeof value === "object" && "final" in value) return String((value as { final?: string }).final || "немає");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, string>).map(([left, right]) => `${text.get(left) ?? left} → ${text.get(right) ?? right}`).join("; ");
  }
  return "немає";
}
