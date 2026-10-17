"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { updatePersonalTargets, type ActionState } from "@/server/actions";

type GoalSubject = {
  id: string;
  name: string;
  targetScore: number | null;
  baseline: { ratingScore: number | null; rawScore: number | null; maxRawScore: number | null } | null;
  priorityPercent: number;
};

export function GoalEditor({ subjects }: { subjects: GoalSubject[] }) {
  const router = useRouter();
  const [goals, setGoals] = useState(() => Object.fromEntries(subjects.map((subject) => [subject.id, String(subject.targetScore ?? "")])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save() {
    const targets = subjects.map((subject) => ({ subjectId: subject.id, targetScore: Number(goals[subject.id]) }));
    if (targets.some((item) => !Number.isInteger(item.targetScore) || item.targetScore < 100 || item.targetScore > 200)) {
      setError("Для кожного предмета вкажи ціль від 100 до 200 балів.");
      setNotice("");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result: ActionState = await updatePersonalTargets(targets);
      if (!result.ok) setError(result.error);
      else {
        setNotice(result.message ?? "Цілі збережено.");
        router.refresh();
      }
    } catch {
      setError("Не вдалося оновити цілі. Перевір з’єднання й повтори спробу.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {subjects.map((subject) => (
          <Card key={subject.id} className="space-y-3 p-4">
            <h2 className="font-semibold">{subject.name}</h2>
            <p className="text-sm text-muted-foreground">
              {subject.baseline?.ratingScore === null || !subject.baseline
                ? "Поточний результат невідомий"
                : `Стартовий рейтинговий бал: ${subject.baseline.ratingScore}`}
            </p>
            {subject.baseline?.rawScore !== null && subject.baseline?.rawScore !== undefined
              ? <p className="text-xs text-muted-foreground">Тестовий бал: {subject.baseline.rawScore}{subject.baseline.maxRawScore === null ? "" : ` із ${subject.baseline.maxRawScore}`}</p>
              : null}
            <label className="block space-y-1 text-sm font-medium">
              <span>Бажаний рейтинговий бал</span>
              <Input
                type="number"
                min={100}
                max={200}
                required
                value={goals[subject.id] ?? ""}
                onChange={(event) => setGoals((current) => ({ ...current, [subject.id]: event.target.value }))}
              />
            </label>
            <p className="text-xs text-muted-foreground">Поточна частка навчального плану: {subject.priorityPercent}%</p>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Зміна цілей оновлює лише майбутні заплановані заняття. Завершені та перенесені заняття, а також історія результатів зберігаються.</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Зберігаємо…" : "Зберегти цілі та оновити план"}</Button>
    </section>
  );
}
