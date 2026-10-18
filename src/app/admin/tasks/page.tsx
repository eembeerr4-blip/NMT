import { Card, PageHeader } from "@/components/ui";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/server/session";

export const dynamic = "force-dynamic";

const statuses = [
  { value: "PLANNED", label: "Заплановано" },
  { value: "IN_PROGRESS", label: "У роботі" },
  { value: "DONE", label: "Виконано" },
  { value: "MOVED", label: "Перенесено" },
  { value: "DROPPED", label: "Скасовано" },
];

export default async function AdminTasksPage() {
  await requireAdministrator();
  const counts = await Promise.all(statuses.map(async (status) => ({
    ...status,
    count: await prisma.studyTask.count({ where: { status: status.value } }),
  })));
  const tasks = await prisma.studyTask.findMany({
    select: {
      id: true, title: true, dateKey: true, kind: true, status: true, durationMin: true,
      subject: { select: { name: true } }, topic: { select: { title: true } },
    },
    orderBy: [{ dateKey: "desc" }, { sortOrder: "asc" }],
    take: 100,
  });
  return (
    <>
      <PageHeader title="Навчальні задачі" description="Зведення задач з наявних персональних планів. Ідентифікатори користувачів та приватні нотатки приховані." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map((item) => <Card key={item.value} className="p-4"><div className="text-sm text-muted-foreground">{item.label}</div><div className="mt-1 text-2xl font-semibold">{item.count.toLocaleString("uk-UA")}</div></Card>)}
      </section>
      <div className="space-y-2">
        {tasks.map((task) => (
          <Card key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><div className="font-medium">{task.title}</div><div className="mt-1 text-sm text-muted-foreground">{task.subject?.name ?? "Без предмета"}{task.topic ? ` · ${task.topic.title}` : ""}</div></div>
            <div className="text-right text-xs text-muted-foreground"><div>{formatUk(task.dateKey)} · {task.durationMin} хв</div><div className="mt-1">{taskStatusLabels[task.status] ?? task.status} · {taskKindLabels[task.kind] ?? task.kind}</div></div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Показано до 100 останніх задач. Змінювати персональні розклади з адміністративної панелі не можна.</p>
    </>
  );
}

const taskStatusLabels: Record<string, string> = {
  PLANNED: "Заплановано",
  IN_PROGRESS: "У роботі",
  DONE: "Виконано",
  MOVED: "Перенесено",
  DROPPED: "Скасовано",
};

const taskKindLabels: Record<string, string> = {
  study: "Навчання",
  mock: "Пробник",
  analysis: "Аналіз помилок",
  rest: "Відпочинок",
  review: "Повторення",
  custom: "Власна задача",
};
