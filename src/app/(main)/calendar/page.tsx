import Link from "next/link";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { addDateKeys, dateKey, formatUk, monthBounds, parseDateKey, startOfWeekMonday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { CustomTaskForm } from "@/components/forms";
import { TaskControls } from "@/components/task-controls";
import { Card, PageHeader } from "@/components/ui";
import { recalculateFuturePlan } from "@/server/actions";
import { requireUser } from "@/server/session";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const view = params.view === "day" || params.view === "week" || params.view === "month" ? params.view : "week";
  const anchor = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : dateKey();
  const month = monthBounds(parseDateKey(anchor));
  const range = view === "day"
    ? { from: anchor, to: anchor }
    : view === "week"
      ? { from: dateKey(startOfWeekMonday(parseDateKey(anchor))), to: addDateKeys(dateKey(startOfWeekMonday(parseDateKey(anchor))), 6) }
      : { from: month.start, to: month.end };
  const [tasks, reviews] = await Promise.all([
    prisma.studyTask.findMany({ where: { userId: user.id, dateKey: { gte: range.from, lte: range.to }, status: { not: "DROPPED" } }, orderBy: [{ dateKey: "asc" }, { sortOrder: "asc" }] }),
    prisma.reviewSchedule.findMany({ where: { userId: user.id, status: "PENDING", dueKey: { gte: range.from, lte: range.to } }, include: { topic: true } }),
  ]);
  const days = each(range.from, range.to);
  return (
    <div className="space-y-6">
      <PageHeader title="Календар" description="Повторювані заняття зберігаються як шаблон. У базі з'являються лише завдання видимого вікна, виконані, пропущені та перенесені." action={<form action={async () => { "use server"; await recalculateFuturePlan(); }}><button className="text-sm underline" type="submit">Перерахувати план</button></form>} />
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/calendar?view=day&date=${anchor}`}>День</Link>
        <Link href={`/calendar?view=week&date=${anchor}`}>Тиждень</Link>
        <Link href={`/calendar?view=month&date=${anchor}`}>Місяць</Link>
        <Link href={`/calendar?view=${view}&date=${addDateKeys(anchor, view === "month" ? -30 : view === "week" ? -7 : -1)}`}>Назад</Link>
        <Link href={`/calendar?view=${view}&date=${addDateKeys(anchor, view === "month" ? 30 : view === "week" ? 7 : 1)}`}>Далі</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {days.map((day) => {
          const dayTasks = tasks.filter((task) => task.dateKey === day);
          const dayReviews = reviews.filter((review) => review.dueKey === day);
          return (
            <Card key={day} className="p-3">
              <div className="mb-2 text-sm font-medium">{WEEKDAY_LABELS[parseDateKey(day).getDay()]}, {formatUk(day, "d MMMM")}</div>
              {dayReviews.map((review) => <Link key={review.id} href={`/learn/${review.topicId}`} className="mb-2 block text-xs underline">Повторення: {review.topic.title}</Link>)}
              {dayTasks.length === 0 && dayReviews.length === 0 ? <p className="text-sm text-muted-foreground">Немає занять.</p> : dayTasks.map((task) => (
                <div key={task.id} className="mb-3 border-t border-border pt-2">
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="text-xs text-muted-foreground">{task.durationMin} хв · {task.status === "MOVED" ? "Перенесено" : task.status === "SKIPPED" ? "Пропущено" : task.status === "DONE" ? "Виконано" : "Заплановано"}</div>
                  <div className="mt-2"><TaskControls task={task} /></div>
                  {task.status !== "DONE" && task.status !== "SKIPPED" ? <form action={async () => { "use server"; const { setTaskStatus } = await import("@/server/actions"); await setTaskStatus(task.id, "SKIPPED"); }}><button className="mt-1 text-xs underline" type="submit">Позначити пропущеним</button></form> : null}
                </div>
              ))}
            </Card>
          );
        })}
      </div>
      <Card className="p-4">
        <h2 className="mb-3 font-medium">Власне заняття</h2>
        <CustomTaskForm dateKey={anchor} />
      </Card>
    </div>
  );
}

function each(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < 42) {
    days.push(cursor);
    cursor = addDateKeys(cursor, 1);
  }
  return days;
}
