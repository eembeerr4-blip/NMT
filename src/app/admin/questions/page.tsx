import Link from "next/link";
import { ImportQuestionsForm, QuestionForm } from "@/components/forms";
import { QuestionModeration } from "@/components/question-moderation";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL } from "@/lib/constants";
import { isAdministrator } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireContentEditor } from "@/server/session";

export const dynamic = "force-dynamic";
const pageSize = 12;
const statuses = [
  { value: "DRAFT", label: "Чернетка" },
  { value: "PENDING_REVIEW", label: "Очікує перевірки" },
  { value: "VERIFIED", label: "Перевірено" },
  { value: "REJECTED", label: "Архівовано" },
];

export default async function QuestionBank({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; topic?: string; status?: string; page?: string }> }) {
  const user = await requireContentEditor();
  const params = await searchParams;
  const base = isAdministrator(user) ? "/admin" : "/editor";
  const query = (params.q ?? "").trim().slice(0, 120);
  const status = statuses.some((item) => item.value === params.status) ? params.status! : "";
  const requested = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(requested, 100000)) : 1;
  const where = {
    ...(status ? { verificationStatus: status } : { verificationStatus: { not: "REJECTED" } }),
    ...(params.subject ? { subjectId: params.subject } : {}),
    ...(params.topic ? { topicId: params.topic } : {}),
    ...(query ? { OR: [{ prompt: { contains: query } }, { source: { contains: query } }] } : {}),
  };
  const [questions, total, topics, subjects] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { topic: true, subject: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
    prisma.topic.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, subjectId: true } }),
    prisma.subject.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageUrl = (next: number) => `${base}/questions?${new URLSearchParams({ page: String(next), ...(query ? { q: query } : {}), ...(params.subject ? { subject: params.subject } : {}), ...(params.topic ? { topic: params.topic } : {}), ...(status ? { status } : {}) })}`;
  return (
    <>
      <PageHeader title="Банк завдань" description="Створюйте, перевіряйте та архівуйте запитання. Використані в тестах завдання захищені від змін, що пошкодять історію спроб." action={<Button asChild variant="outline"><a href="/api/export/questions">Експорт</a></Button>} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4"><details><summary className="cursor-pointer font-semibold">Створити завдання</summary><div className="pt-4"><QuestionForm topics={topics} returnTo={`${base}/questions`}/></div></details></Card>
        <Card className="p-4"><details><summary className="cursor-pointer font-semibold">Імпортувати перевірений набір JSON</summary><p className="py-3 text-sm text-muted-foreground">Окремий імпорт лише завдань. Теми й уроки завантажуйте пакетом у розділі <Link href={`${base}/import`}>Імпорт матеріалів</Link>.</p><ImportQuestionsForm/></details></Card>
      </div>
      <Card className="space-y-4 p-4 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_200px_220px_200px_auto]">
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Пошук</span><input name="q" defaultValue={query} placeholder="Текст завдання або джерело"/></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Предмет</span><select name="subject" defaultValue={params.subject ?? ""}><option value="">Усі предмети</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Тема</span><select name="topic" defaultValue={params.topic ?? ""}><option value="">Усі теми</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">Стан</span><select name="status" defaultValue={status}><option value="">Активні</option>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="flex items-end gap-2"><Button type="submit">Знайти</Button><Button asChild variant="ghost"><Link href={`${base}/questions`}>Скинути</Link></Button></div>
        </form>
        <p className="text-sm text-muted-foreground">Знайдено {total.toLocaleString("uk-UA")} завдань.</p>
      </Card>
      {questions.length === 0 ? <EmptyState title="Завдань не знайдено" text="Змініть пошук або фільтри предмета, теми чи статусу."/> : (
        <div className="space-y-3">
          {questions.map((question) => (
            <Card key={question.id} className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2"><Badge>{question.subject.name}</Badge><Badge>{question.topic?.title ?? "Без теми"}</Badge><Badge>{QUESTION_TYPE_LABEL[question.type] ?? question.type}</Badge><Badge>{DIFFICULTY_LABEL[question.difficulty] ?? question.difficulty}</Badge><Badge>{statuses.find((item) => item.value === question.verificationStatus)?.label ?? question.verificationStatus}</Badge></div>
                <Button asChild variant="outline" size="sm"><Link href={`${base}/questions/${question.id}`}>Редагувати</Link></Button>
              </div>
              <p className="line-clamp-4 text-sm leading-6">{question.prompt}</p>
              {question.source ? <p className="text-xs text-muted-foreground">Джерело: {question.source}</p> : null}
              {question.issueReport ? <p className="text-sm text-danger-text">Зауваження: {question.issueReport}</p> : null}
              <QuestionModeration id={question.id} status={question.verificationStatus}/>
            </Card>
          ))}
        </div>
      )}
      <nav aria-label="Сторінки банку запитань" className="flex items-center justify-between gap-3 text-sm"><span>Сторінка {page} із {pageCount}</span><div className="flex gap-2">{page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page - 1)}>Назад</Link></Button> : null}{page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageUrl(page + 1)}>Далі</Link></Button> : null}</div></nav>
    </>
  );
}
