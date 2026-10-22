"use client";

import { completeLesson } from "@/server/actions";
import { Button } from "@/components/ui";
import { useActionFeedback } from "./use-action-feedback";

export function CompleteLesson({ topicId, needsPractice }: { topicId: string; needsPractice: boolean }) {
  const { pending, result, run } = useActionFeedback();
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const studied = new FormData(event.currentTarget).get("studied") === "on";
        await run(() => completeLesson(topicId, studied));
      }}
    >
      {needsPractice ? null : (
        <label className="flex items-center gap-2 text-sm">
          <input name="studied" type="checkbox" disabled={pending} /> Я опрацював конспект
        </label>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Збереження…" : needsPractice ? "Завершити урок" : "Позначити конспект як опрацьований"}
      </Button>
      {result ? (
        <p role={result.ok ? "status" : "alert"} className="text-sm text-muted-foreground">
          {result.ok ? result.message ?? "Урок зараховано." : result.error}
        </p>
      ) : null}
    </form>
  );
}
