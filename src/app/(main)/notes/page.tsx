import { formatUk } from "@/lib/dates";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MathText } from "@/components/math-text";
import { NoteForm } from "@/components/forms";
import { NoteDeleteButton } from "@/components/note-delete-button";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { SUBJECTS } from "@/lib/constants";
import { requireUser } from "@/server/session";

export default async function NotesPage() {
  const user = await requireUser();
  const [notes, topics] = await Promise.all([
    prisma.note.findMany({ where: { userId: user.id }, include: { topic: true }, orderBy: { updatedAt: "desc" } }),
    prisma.topic.findMany({ select: { id: true, title: true, subjectId: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const activeSubjects = new Set(user.subjects.filter((item) => item.active).map((item) => item.subjectId));
  const availableTopics = topics.filter((topic) => activeSubjects.has(topic.subjectId));
  return (
    <div className="space-y-6">
      <PageHeader title="Мої конспекти" description="Особисті нотатки доступні лише вам. Додавайте пояснення й тези до навчальних тем." />
      <Card className="p-4 sm:p-5">
        <details>
          <summary className="cursor-pointer text-base font-semibold">Створити конспект</summary>
          <div className="mt-4"><NoteForm topics={availableTopics} /></div>
        </details>
      </Card>
      {notes.length === 0 ? (
        <EmptyState title="Конспектів ще немає" text="Створіть перший запис. За бажанням пов’яжіть його з темою, щоб швидко знайти під час навчання." />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{note.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {note.topic ? `${SUBJECTS.find((subject) => subject.id === note.topic?.subjectId)?.name ?? "Предмет"} · ${note.topic.title}` : "Без теми"} · змінено {formatUk(note.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {note.topicId ? <Button asChild variant="outline" size="sm"><Link href={`/topics/${note.topicId}`}>Відкрити тему</Link></Button> : null}
                  <NoteDeleteButton id={note.id} />
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-primary">Переглянути текст</summary>
                <MathText text={note.content} className="mt-3 leading-6" />
              </details>
              <details className="border-t border-border pt-3">
                <summary className="cursor-pointer text-sm font-medium">Редагувати конспект</summary>
                <div className="mt-3"><NoteForm topics={availableTopics} note={{ id: note.id, title: note.title, content: note.content, topicId: note.topicId }} /></div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
