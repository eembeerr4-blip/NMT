"use client";

import { useState } from "react";
import { ELECTIVE_SUBJECT_IDS, SUBJECTS } from "@/lib/constants";
import { changeElective, type ActionState } from "@/server/actions";
import { Button } from "./ui";

export function ElectiveForm({ elective }: { elective?: string }) {
  const [result, setResult] = useState<ActionState | null>(null);
  const [pending, setPending] = useState(false);
  return <form className="space-y-3" onSubmit={async event => {
    event.preventDefault();
    if(pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setResult(null);
    try { setResult(await changeElective(String(form.get("subjectId") ?? ""), form.get("confirm") === "on")); }
    catch { setResult({ok:false,error:"Не вдалося змінити предмет. Перевірте з’єднання та спробуйте ще раз."}); }
    finally { setPending(false); }
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
