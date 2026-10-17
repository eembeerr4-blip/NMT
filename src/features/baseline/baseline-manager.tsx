"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { saveBaselineResult, type ActionState } from "@/server/actions";
import { SUBJECT_RESOURCES } from "@/features/onboarding/subjects";
import { BaselineForm } from "./baseline-form";

type SubjectBaseline = {
  id: string;
  name: string;
  role: string;
  baseline: {
    id: string;
    subjectId: string;
    date: string;
    title: string;
    ratingScore: number | null;
    rawScore: number | null;
    maxRawScore: number | null;
    partial: boolean;
    belowThreshold: boolean;
    comment: string;
  } | null;
};

export function BaselineManager({ subjects, today }: { subjects: SubjectBaseline[]; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(values: Parameters<typeof saveBaselineResult>[0]) {
    setError("");
    setNotice("");
    try {
      const result: ActionState = await saveBaselineResult(values);
      if (!result.ok) setError(result.error);
      else {
        setNotice(result.message ?? "Стартовий результат збережено.");
        router.refresh();
      }
    } catch {
      setError("Не вдалося зберегти результат. Перевір з’єднання й повтори спробу.");
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">Результати зберігаються лише у твоєму профілі. Рейтингові бали не обчислюються автоматично, а нові результати навчання не замінюють стартовий baseline.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {subjects.map((subject) => {
          const resource = SUBJECT_RESOURCES[subject.id as keyof typeof SUBJECT_RESOURCES];
          const result = subject.baseline;
          return (
            <Card key={subject.id} className="space-y-3 p-4">
              <div>
                <h2 className="font-semibold">{subject.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{resource?.kind === "catalog" ? "Каталог предмета · Освіта.ua" : "Тренувальні тести · ЗНО.Освіта.ua"}</p>
              </div>
              {resource ? <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-medium text-primary hover:underline">Відкрити зовнішні тести ↗</a> : <p className="text-sm text-destructive">Для цього предмета немає перевіреного зовнішнього посилання.</p>}
              {result ? (
                <p className="text-sm text-muted-foreground">
                  {result.title} · {new Intl.DateTimeFormat("uk-UA").format(new Date(result.date))}
                  {" · "}{result.ratingScore === null ? "рейтинговий бал невідомий" : `${result.ratingScore} рейтингових балів`}
                  {result.partial ? " · частковий тест" : ""}
                  {result.belowThreshold ? " · поріг не подолано" : ""}
                </p>
              ) : <p className="text-sm text-muted-foreground">Стартовий результат не додано.</p>}
              <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setEditing(editing === subject.id ? null : subject.id)}>{result ? "Змінити результат" : "Додати результат"}</button>
              {editing === subject.id ? (
                <BaselineForm
                  subject={subject}
                  initial={result ? { ...result, date: result.date.slice(0, 10) } : undefined}
                  today={today}
                  onSave={save}
                />
              ) : null}
            </Card>
          );
        })}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
    </section>
  );
}
