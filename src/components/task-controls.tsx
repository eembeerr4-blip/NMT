"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionFeedback } from "./use-action-feedback";
import { moveTask, setTaskStatus } from "@/server/actions";
import { Badge, Button, Input } from "@/components/ui";

export function TaskControls({ task }: { task: { id: string; status: string; topicId: string | null; kind: string; templateKey?: string | null } }) {
  const router = useRouter();
  const {pending,result,run}=useActionFeedback();
  if (task.templateKey?.startsWith("zno:")) return <Button asChild size="sm" variant="outline"><Link href="/exams">Відкрити призначення ZNO Online</Link></Button>;
  if (task.status === "MOVED") return <Badge>Перенесено</Badge>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.status === "DONE" ? <Badge>Завершено</Badge> : null}
      {task.status === "PLANNED" ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => setTaskStatus(task.id, "IN_PROGRESS"), () => {
          if (task.topicId) router.push(`/topics/${task.topicId}`);
          else if (task.kind === "mock") router.push("/exams");
          else router.refresh();
        })}>Розпочати</Button>
      ) : null}
      {task.status === "IN_PROGRESS" && task.topicId ? <Button asChild size="sm"><Link href={`/topics/${task.topicId}`}>Продовжити</Link></Button> : null}
      {task.status === "IN_PROGRESS" && !task.topicId && task.kind === "mock" ? <Button asChild size="sm"><Link href="/exams">Продовжити</Link></Button> : null}
      {task.status !== "DONE" && task.kind !== "rest" ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setTaskStatus(task.id, "DONE"), () => router.refresh())}>Завершено</Button>
      ) : null}
      {["PLANNED","IN_PROGRESS"].includes(task.status) ? <Button size="sm" variant="outline" disabled={pending} onClick={()=>run(()=>setTaskStatus(task.id,"SKIPPED"),()=>router.refresh())}>Позначити пропущеним</Button> : null}
      {task.status !== "DONE" ? (
        <form className="flex gap-2" onSubmit={async (event) => {
          event.preventDefault();
          const nextDate = String(new FormData(event.currentTarget).get("nextDate") ?? "");
          await run(() => moveTask(task.id, nextDate), () => router.refresh());
        }}>
          <Input type="date" name="nextDate" className="h-8 w-36" required aria-label="Нова дата" />
          <Button size="sm" variant="outline" type="submit" disabled={pending}>Перенести</Button>
        </form>
      ) : null}
      {result ? <span role={result.ok?"status":"alert"} className="text-xs text-muted-foreground">{result.ok?result.message??"Зміни збережено.":result.error}</span> : null}
    </div>
  );
}

