import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Clock3, CornerUpRight, Pause, X } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { SubjectIcon } from "@/components/subject-icon";
import { TaskControls } from "@/components/task-controls";
import { formatUk } from "@/lib/dates";
import { lessonAccess } from "@/lib/readiness";

export const taskStatusLabels: Record<string, string> = {
  PLANNED: "Заплановано", IN_PROGRESS: "У роботі", DONE: "Виконано",
  MOVED: "Перенесено", SKIPPED: "Пропущено", DROPPED: "Скасовано",
};

export type RouteTask = {
  id: string; dateKey: string; title: string; detail: string; durationMin: number;
  status: string; topicId: string | null; subjectId: string | null; kind: string;
  movedFromId: string | null;
  notes?: string;
  templateKey?: string | null;
  subject: { name: string } | null;
  topic: { id: string; title: string; lessonJson: string; coverage?: string; questions: unknown[]; videos: { reviewStatus: string }[] } | null;
};

export function LearningRoute({ tasks, offset }: { tasks: RouteTask[]; offset: number }) {
  return <ol className="d02-timeline" start={offset + 1} aria-label="Заняття навчального маршруту">
    {tasks.map((task, index) => {
      const available = task.topic ? lessonAccess(task.topic).available : false;
      const calendar = `/calendar?view=day&date=${task.dateKey}`;
      const inactive = task.status === "MOVED" || task.status === "DROPPED";
      const stage = task.status === "DONE" ? "done" : task.status === "IN_PROGRESS" ? "current" : "future";
      const Marker = task.status === "DONE" ? Check : task.status === "MOVED" ? CornerUpRight : task.status === "SKIPPED" ? Pause : task.status === "DROPPED" ? X : null;
      const href = !inactive && available && task.topicId ? `/learn/${task.topicId}` : !inactive && task.kind === "mock" ? "/exams" : calendar;
      const label = inactive ? "У календарі" : available ? task.status === "IN_PROGRESS" ? "Продовжити" : task.status === "DONE" ? "Переглянути урок" : "Почати урок" : task.kind === "mock" ? "До пробників" : "У календарі";
      return <li key={task.id} className="d02-stage" data-stage={stage} data-status={task.status} data-task-id={task.id} aria-current={stage === "current" ? "step" : undefined}>
        <span className="d02-marker" aria-hidden="true">{Marker ? <Marker /> : offset + index + 1}</span>
        <Card className="d02-step-card">
          <div className="d02-step-main">
            <SubjectIcon id={task.subjectId ?? "other"} variant="dashboard" small />
            <div className="d02-step-copy">
              <h3>{task.title}</h3>
              <p className="d02-meta"><span>{task.subject?.name ?? "Власне заняття"}</span><span><CalendarDays aria-hidden="true" /><time dateTime={task.dateKey}>{formatUk(task.dateKey, "d MMM yyyy")}</time></span><span><Clock3 aria-hidden="true" />{task.durationMin > 0 ? `${task.durationMin} хв загалом` : "Тривалість не вказана"}</span></p>
              <p className="d02-step-state"><span className="d02-status">{taskStatusLabels[task.status] ?? task.status}</span>{task.movedFromId && task.status !== "MOVED" ? <span>Перенесено на цю дату</span> : null}{task.topic && !available ? <span>Матеріал готується</span> : !task.topicId && task.subjectId && task.kind === "study" ? <span>Тему ще не призначено</span> : null}</p>
            </div>
            <Button asChild variant={stage === "current" ? "default" : "outline"} size="sm" className="d02-step-cta"><Link href={href}>{label}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link></Button>
          </div>
          <details className="d02-step-details">
            <summary>Деталі та дії заняття</summary>
            <div>
              {task.detail ? <p>{task.detail}</p> : null}
              {task.notes ? <p>{task.notes}</p> : null}
              {task.topic && !available ? <p>Урок ще не доступний. Огляд теми та керування заняттям залишаються доступними.</p> : null}
              {task.topicId ? <Link className="d02-text-link" href={`/topics/${task.topicId}`}>Огляд теми: {task.topic?.title ?? task.title}</Link> : null}
              {inactive ? <p>{task.status === "MOVED" ? "Це запис перенесення. Актуальне заняття знайдеш на новій даті в маршруті або календарі." : "Заняття скасовано. Запис збережено в історії плану."}</p> : <TaskControls task={{ id: task.id, status: task.status, topicId: task.topicId, kind: task.kind, templateKey: task.templateKey }} />}
              <Link className="d02-text-link" href={calendar}>Відкрити день у календарі</Link>
            </div>
          </details>
        </Card>
      </li>;
    })}
  </ol>;
}
