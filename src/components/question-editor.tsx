import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/forms";
import { Button, Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireAdministrator, requireContentEditor } from "@/server/session";


export async function QuestionEditor({ params, basePath }: { params: Promise<{ id: string }>; basePath: "/admin" | "/editor" }) {
  if (basePath === "/admin") await requireAdministrator();
  else await requireContentEditor();
  const { id } = await params;
  const [question, topics] = await Promise.all([
    prisma.question.findUnique({ where: { id }, include: { options: { orderBy: { sortOrder: "asc" } } } }),
    prisma.topic.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, subjectId: true } }),
  ]);
  if (!question) notFound();
  return (
    <>
      <PageHeader title="Редагувати завдання" description="Після зміни завдання буде повторно перевірено. Завдання, пов’язане з тестами, не можна змінити так, щоб пошкодити історію спроб." action={<Button asChild variant="outline"><Link href={`${basePath}/questions`}>До банку завдань</Link></Button>} />
      {question.topicId ? <Button asChild variant="outline"><Link href={`/learn/${question.topicId}`}>Переглянути як учень</Link></Button> : null}
      <Card className="max-w-4xl p-4 sm:p-6">
        <QuestionForm topics={topics} returnTo={`${basePath}/questions`} initial={{
          id: question.id,
          subjectId: question.subjectId,
          topicId: question.topicId,
          subtopic: question.subtopic,
          type: question.type,
          difficulty: question.difficulty,
          prompt: question.prompt,
          explanation: question.explanation,
          correctAnswer: question.correctAnswer,
          source: question.source,
          verificationStatus: question.verificationStatus,
          options: question.options.map(({ id, label, text, matchKey }) => ({ id, label, text, matchKey })),
        }} />
      </Card>
    </>
  );
}
