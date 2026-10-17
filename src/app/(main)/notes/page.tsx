import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { MathText } from "@/components/math-text";
import { NoteForm } from "@/components/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { deleteNote } from "@/server/actions";
import { requireUser } from "@/server/session";

export default async function NotesPage() {
  const user = await requireUser();
  const [notes, topics] = await Promise.all([
    prisma.note.findMany({ where: { userId: user.id }, include: { topic: true }, orderBy: { updatedAt: "desc" } }),
    prisma.topic.findMany({ select: { id: true, title: true, subjectId: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Конспекти" description="Короткі записи до тем. Формули в доларах відображаються як математика." />
      <Card className="p-4"><NoteForm topics={topics} /></Card>
      {notes.length === 0 ? <EmptyState title="Конспектів ще немає" text="Додайте перший запис або відкрийте тему з готовим конспектом." /> : notes.map((note) => (
        <Card key={note.id} className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="font-medium">{note.title}</h2><span className="text-xs text-muted-foreground">{formatUk(note.updatedAt)}</span></div>
          <p className="text-xs text-muted-foreground">{note.topic?.title ?? "Без теми"}</p>
          <MathText text={note.content} className="text-sm" />
          <form action={async () => { "use server"; await deleteNote(note.id); }}><button className="text-sm underline" type="submit">Видалити</button></form>
        </Card>
      ))}
    </div>
  );
}
