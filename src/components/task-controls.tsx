"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { moveTask, recalculateFuturePlan, setTaskStatus } from "@/server/actions";
import { Badge, Button, Input } from "@/components/ui";

export function TaskControls({ task }: { task: { id: string; status: string; topicId: string | null; kind: string } }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  if (task.status === "MOVED") return <Badge>Перенесено</Badge>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.status === "DONE" ? <Badge>Завершено</Badge> : null}
      {task.status === "PLANNED" ? (
        <Button size="sm" onClick={async () => {
          await setTaskStatus(task.id, "IN_PROGRESS");
          if (task.topicId) router.push(`/topics/${task.topicId}`);
          else if (task.kind === "mock") router.push("/exams");
          else router.refresh();
        }}>Розпочати</Button>
      ) : null}
      {task.status === "IN_PROGRESS" && task.topicId ? <Button asChild size="sm"><Link href={`/topics/${task.topicId}`}>Продовжити</Link></Button> : null}
      {task.status === "IN_PROGRESS" && !task.topicId && task.kind === "mock" ? <Button asChild size="sm"><Link href="/exams">Продовжити</Link></Button> : null}
      {task.status !== "DONE" && task.kind !== "rest" ? (
        <Button size="sm" variant="secondary" onClick={async () => { await setTaskStatus(task.id, "DONE"); router.refresh(); }}>Завершено</Button>
      ) : null}
      {task.status !== "DONE" ? (
        <form className="flex gap-2" onSubmit={async (event) => {
          event.preventDefault();
          const nextDate = String(new FormData(event.currentTarget).get("nextDate") ?? "");
          const result = await moveTask(task.id, nextDate);
          setMessage(result.ok ? "Заняття перенесено." : result.error);
          if (result.ok) router.refresh();
        }}>
          <Input type="date" name="nextDate" className="h-8 w-36" required aria-label="Нова дата" />
          <Button size="sm" variant="outline" type="submit">Перенести</Button>
        </form>
      ) : null}
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}

export function RecalculatePlanButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <div className="space-y-1">
    <Button type="button" variant="outline" disabled={pending} onClick={async () => {
      setPending(true);
      try {
        const result = await recalculateFuturePlan();
        setMessage(result.ok ? result.message ?? "План перераховано." : result.error);
        if (result.ok) router.refresh();
      } finally { setPending(false); }
    }}>{pending ? "Перерахунок…" : "Перерахувати план"}</Button>
    {message ? <p role="status" className="max-w-md text-xs text-muted-foreground">{message}</p> : null}
  </div>;
}