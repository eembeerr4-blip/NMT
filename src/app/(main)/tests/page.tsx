import Link from "next/link";
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { ImportQuestionsForm, QuestionForm } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { deleteQuestion, verifyQuestion } from "@/server/actions";
import { requireUser } from "@/server/session";

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string; q?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const query = params.q?.trim() ?? "";
  const where = query ? { OR: [{ prompt: { contains: query } }, { source: { contains: query } }] } : {};
  const [attempts, questions, total, topics] = await Promise.all([
    prisma.testAttempt.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 12, include: { test: { include: { topic: true, subject: true } } } }),
    prisma.question.findMany({ where, include: { topic: true, subject: true }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * 12, take: 12 }),
    prisma.question.count({ where }),
    prisma.topic.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, subjectId: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Тести" description="Тематичні спроби і власний банк завдань. У тест потрапляють лише перевірені питання." />
      <div className="flex gap-2 text-sm">
        <Link href="/tests" className="rounded-lg bg-muted px-3 py-1.5">Спроби</Link>
        <Link href="/tests?view=bank" className="rounded-lg bg-muted px-3 py-1.5">Банк запитань</Link>
        <a href="/api/export/questions" className="rounded-lg border border-border px-3 py-1.5">Експорт JSON</a>
      </div>
      {params.view === "bank" ? (
        <div className="space-y-4">
          <Card className="p-4"><QuestionForm topics={topics} /></Card>
          <Card className="p-4"><ImportQuestionsForm /></Card>
          <form className="flex gap-2"><input name="q" defaultValue={query} placeholder="Пошук" className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm" /><button className="rounded-lg border border-border px-3 text-sm">Знайти</button></form>
          {questions.length === 0 ? <EmptyState title="Банк порожній за цим запитом" text="Додайте авторське завдання або імпортуйте JSON. Офіційні тести сюди автоматично не підставляються." /> : questions.map((question) => (
            <Card key={question.id} className="space-y-2 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{question.subject.name}</Badge>
                <Badge>{question.topic?.title ?? "Без теми"}</Badge>
                <Badge>{QUESTION_TYPE_LABEL[question.type]}</Badge>
                <Badge>{DIFFICULTY_LABEL[question.difficulty]}</Badge>
                <Badge>{question.generatedByAi ? "AI-чернетка" : question.verificationStatus === "VERIFIED" ? "Перевірено" : "Не в тесті"}</Badge>
              </div>
              <p className="text-sm">{question.prompt}</p>
              <p className="text-xs text-muted-foreground">{question.source || "Джерело не вказано"}</p>
              {question.issueReport ? <p className="text-xs">Зауваження: {question.issueReport}</p> : null}
              <div className="flex flex-wrap gap-2">
                <form action={async () => { "use server"; await verifyQuestion(question.id, "VERIFIED"); }}><button className="text-sm underline" type="submit">Позначити перевіреним</button></form>
                <form action={async () => { "use server"; await deleteQuestion(question.id); }}><button className="text-sm underline" type="submit">Видалити</button></form>
              </div>
            </Card>
          ))}
          <div className="flex gap-3 text-sm">
            {page > 1 ? <Link href={`/tests?view=bank&page=${page - 1}&q=${query}`}>Назад</Link> : null}
            {page * 12 < total ? <Link href={`/tests?view=bank&page=${page + 1}&q=${query}`}>Далі</Link> : null}
          </div>
        </div>
      ) : attempts.length === 0 ? <EmptyState title="Спроб ще немає" text="Відкрийте тему з перевіреними завданнями і натисніть «Пройти тест»." /> : (
        <div className="space-y-2">
          {attempts.map((attempt) => (
            <Link key={attempt.id} href={`/tests/${attempt.id}`} className="block rounded-2xl border border-border bg-card p-4">
              <div className="font-medium">{attempt.test.title}</div>
              <div className="text-sm text-muted-foreground">{attempt.status === "COMPLETED" ? `${attempt.correctCount}/${attempt.totalCount}` : "Чернетка збережена"} · {attempt.test.subject?.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
