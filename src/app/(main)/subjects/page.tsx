import { ArrowRight } from "lucide-react";
import { SubjectIcon } from "@/components/subject-icon";
import { lessonReadiness } from "@/lib/readiness";
import Link from "next/link";
import { COVERAGE_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Progress } from "@/components/ui";
import { requireUser } from "@/server/session";

export default async function SubjectsPage() {
  const user = await requireUser();
  const active = new Set(user.subjects.filter((item) => item.active).map((item) => item.subjectId));
  const [subjects, progress] = await Promise.all([
    prisma.subject.findMany({ orderBy: { sortOrder: "asc" }, include: { topics: { include: { children: { select: { id: true } }, questions: { where: { verificationStatus: "VERIFIED" }, select: { difficulty: true } }, videos: { select: { reviewStatus: true } } } } } }),
    prisma.userTopicProgress.findMany({ where: { userId: user.id } }),
  ]);
  const status = new Map(progress.map((item) => [item.topicId, item.status]));
  return (
    <div className="space-y-6">
      <PageHeader title="Предмети" description="Три обов'язкові предмети й один на вибір. Інші предмети видно як бібліотеку, їхній прогрес не змішується з вашим." />
      <Link href="/curriculum" className="block text-sm underline">Переглянути готовність усіх тем</Link>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => {
          const leaves = subject.topics.filter((topic) => !subject.topics.some((child) => child.parentId === topic.id));
          const mastered = leaves.filter((topic) => status.get(topic.id) === "MASTERED").length;
          const coverage = leaves.length && leaves.every((topic) => lessonReadiness(topic).ready) ? "READY" : leaves.some((topic) => lessonReadiness(topic).canStudy || topic.questions.length > 0) ? "PARTIAL" : "NEEDS_CONTENT";
          const percent = leaves.length ? Math.round((mastered / leaves.length) * 100) : 0;
          return (
            <Link key={subject.id} href={`/subjects/${subject.id}`}>
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-primary/50">
                <SubjectIcon id={subject.id}/><div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{subject.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{subject.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{active.has(subject.id) ? "У вашому плані" : "Не в поточному наборі"} · {COVERAGE_LABEL[coverage]}</p>
                  </div>

                </div>
                <div className="mt-5 flex items-center justify-between text-sm"><span className="text-muted-foreground">Засвоєно {mastered} із {leaves.length} тем</span><span className="font-semibold">{percent}%</span></div>
                <div className="mt-2"><Progress value={percent} /></div><div className="mt-5 flex items-center justify-between border-t border-border pt-3"><span className="text-xs text-muted-foreground">{subject.topics.filter(topic=>!topic.parentId).length} розділів · {leaves.length} тем</span><span className="rounded-full bg-muted p-2 text-primary"><ArrowRight className="h-4 w-4"/></span></div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
