"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { changeElective, type ActionState } from "@/server/actions";

type ElectiveOption = { id: string; name: string };

export function ElectiveSubjectForm({ subjects, selected }: { subjects: ElectiveOption[]; selected: string }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(selected);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result: ActionState = await changeElective(subjectId, confirmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmed(false);
      setNotice(result.message ?? "Предмет на вибір оновлено.");
      router.refresh();
    } catch {
      setError("Не вдалося змінити предмет. Перевір з’єднання й повтори спробу.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <select
        name="subjectId"
        value={subjectId}
        onChange={(event) => setSubjectId(event.target.value)}
        className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
        aria-label="Предмет на вибір"
      >
        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        Підтверджую зміну
      </label>
      <Button type="submit" variant="outline" disabled={busy}>
        {busy ? "Зберігаємо…" : "Змінити предмет"}
      </Button>
      {error ? <p role="alert" className="w-full text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="w-full text-sm text-muted-foreground">{notice}</p> : null}
    </form>
  );
}
