import Link from "next/link";
import { isAdministrator } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { COVERAGE_LABEL } from "@/lib/constants";
import { parseLesson } from "@/lib/lesson";
import { prisma } from "@/lib/prisma";
import { requireContentEditor } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminLessonsPage() {
  const user=await requireContentEditor();
  const base=isAdministrator(user)?"/admin":"/editor";
  const topics = await prisma.topic.findMany({
    select: {
      id: true,
      title: true,
      lessonJson: true,
      summary: true,
      coverage: true,
      subject: { select: { name: true } },
      videos: { select: { id: true, reviewStatus: true } },
      _count: { select: { questions: true } },
    },
    orderBy: [{ subjectId: "asc" }, { sortOrder: "asc" }],
    take: 300,
  });
  return (
    <>
      <PageHeader title="Уроки" description="Стан наявних матеріалів за темами. Оберіть урок, щоб редагувати його матеріали або відео." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-muted-foreground">Уроки з конспектом</div><div className="mt-1 text-2xl font-semibold">{topics.filter((topic) => Boolean(parseLesson(topic.lessonJson))).length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Теми з описом</div><div className="mt-1 text-2xl font-semibold">{topics.filter((topic) => Boolean(topic.summary.trim())).length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Пов’язані відео</div><div className="mt-1 text-2xl font-semibold">{topics.reduce((sum, topic) => sum + topic.videos.length, 0)}</div></Card>
      </div>
      <div className="space-y-2">
        {topics.map((topic) => {
          const lesson = parseLesson(topic.lessonJson);
          return (
            <Card key={topic.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0"><div className="text-xs text-muted-foreground">{topic.subject.name} · {COVERAGE_LABEL[topic.coverage] ?? topic.coverage}</div><div className="mt-1 font-medium">{topic.title}</div></div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{lesson ? "Конспект є" : "Без конспекту"}</span>
                <span>{lesson?.examples.length ?? 0} прикладів</span>
                <span>{topic._count.questions} завдань</span>
                <span>{topic.videos.length} відео</span>
                <Link href={`${base}/lessons/${topic.id}`} className="font-medium text-primary hover:underline">Редагувати урок</Link>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Показано до 300 тем. Додавання та редагування контенту доступні лише через наявні безпечні інструменти редактора.</p>
    </>
  );
}
