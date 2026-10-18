import Link from "next/link";
import { isAdministrator } from "@/lib/permissions";
import { Card, PageHeader, Progress } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireContentEditor } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminSubjectsPage() {
  const user=await requireContentEditor();
  const base=isAdministrator(user)?"/admin":"/editor";

  const subjects = await prisma.subject.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { topics: true, questions: true, tests: true } }, topics: { select: { id: true, parentId: true, status: true } } },
  });
  return (
    <>
      <PageHeader title="Предмети" description="Предмети, описи та пов’язані навчальні матеріали." />
      <div className="grid gap-4 lg:grid-cols-2">
        {subjects.map((subject) => {
          const leafTopics = subject.topics.filter((topic) => !subject.topics.some((item) => item.parentId === topic.id));
          const mastered = leafTopics.filter((topic) => topic.status === "MASTERED").length;
          const percent = leafTopics.length ? Math.round(mastered * 100 / leafTopics.length) : 0;
          return (
            <Card key={subject.id} className="space-y-4 p-5">
              <div className="flex items-start gap-3"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: subject.color }} /><div className="min-w-0"><h2 className="font-semibold">{subject.name}</h2><p className="mt-1 text-sm text-muted-foreground">{subject.description}</p></div></div>
              <div className="grid grid-cols-3 gap-2 text-sm"><div className="rounded-xl bg-muted p-3"><b>{subject._count.topics}</b><div className="text-xs text-muted-foreground">теми</div></div><div className="rounded-xl bg-muted p-3"><b>{subject._count.questions}</b><div className="text-xs text-muted-foreground">завдання</div></div><div className="rounded-xl bg-muted p-3"><b>{subject._count.tests}</b><div className="text-xs text-muted-foreground">тести</div></div></div>
              <div><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Позначено засвоєними в каталозі</span><span>{mastered}/{leafTopics.length}</span></div><Progress value={percent} /></div>
              <Link href={`${base}/subjects/${subject.id}`} className="inline-flex text-sm font-semibold text-primary">Редагувати предмет →</Link>
              <Link href={`${base}/topics?subject=${encodeURIComponent(subject.id)}`} className="inline-flex text-sm font-medium text-primary hover:underline">Переглянути розділи й теми →</Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
