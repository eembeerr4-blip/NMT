import Link from "next/link";
import { COVERAGE_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Progress } from "@/components/ui";
import { requireUser } from "@/server/session";

export default async function SubjectsPage() {
  const user = await requireUser();
  const active = new Set(user.subjects.filter((item) => item.active).map((item) => item.subjectId));
  const [subjects, progress] = await Promise.all([
    prisma.subject.findMany({ orderBy: { sortOrder: "asc" }, include: { topics: true } }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id } }),
  ]);
  const status = new Map(progress.map((item) => [item.topicId, item.status]));
  return (
    <div className="space-y-6">
      <PageHeader title="Предмети" description="Три обов'язкові предмети й один на вибір. Інші предмети видно як бібліотеку, їхній прогрес не змішується з вашим." />
      <div className="grid gap-4 md:grid-cols-2">
        {subjects.map((subject) => {
          const leaves = subject.topics.filter((topic) => !subject.topics.some((child) => child.parentId === topic.id));
          const mastered = leaves.filter((topic) => status.get(topic.id) === "MASTERED").length;
          const coverage = leaves.some((topic) => topic.coverage === "PARTIAL") ? "PARTIAL" : leaves.every((topic) => topic.coverage === "READY") && leaves.length ? "READY" : "NEEDS_CONTENT";
          const percent = leaves.length ? Math.round((mastered / leaves.length) * 100) : 0;
          return (
            <Link key={subject.id} href={`/subjects/${subject.id}`}>
              <Card className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{subject.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{subject.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{active.has(subject.id) ? "У вашому плані" : "Не в поточному наборі"} · {COVERAGE_LABEL[coverage]}</p>
                  </div>
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: subject.color }} />
                </div>
                <div className="mt-4 text-sm">{mastered} із {leaves.length} тем</div>
                <div className="mt-2"><Progress value={percent} /></div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
