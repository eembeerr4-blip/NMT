"use client";

import { useActionFeedback } from "./use-action-feedback";
import { ELECTIVE_SUBJECT_IDS, SUBJECTS } from "@/lib/constants";
import { changeElective } from "@/server/actions";
import { Button } from "./ui";

export function ElectiveForm({ elective }: { elective?: string }) {
  const {pending,result,run}=useActionFeedback();
  return <form className="space-y-3" onSubmit={async event => {
    event.preventDefault();
    if(pending) return;
    const form = new FormData(event.currentTarget);
    await run(() => changeElective(String(form.get("subjectId") ?? ""), form.get("confirm") === "on"));
  }}>
    <fieldset disabled={pending} className="flex flex-wrap items-center gap-2">
      <label className="grid gap-1 text-sm">Новий предмет
        <select name="subjectId" defaultValue={elective} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
          {SUBJECTS.filter(subject=>(ELECTIVE_SUBJECT_IDS as readonly string[]).includes(subject.id)).map(subject=><option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm"/>Підтверджую зміну</label>
      <Button type="submit" variant="outline">{pending ? "Зміна предмета…" : "Змінити предмет"}</Button>
    </fieldset>
    {result ? <p role={result.ok ? "status" : "alert"} className="text-sm">{result.ok ? result.message : result.error}</p> : null}
  </form>;
}
