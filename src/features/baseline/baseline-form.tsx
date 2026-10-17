"use client";

import { Button, Input } from "@/components/ui";

type BaselineSubject = { id: string; name: string };
type BaselineResult = {
  id: string;
  subjectId: string;
  date: string;
  title: string;
  ratingScore: number | null;
  rawScore: number | null;
  maxRawScore: number | null;
  belowThreshold: boolean;
  partial: boolean;
  comment: string;
};

function parseOptionalScore(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw === "" ? null : Number(raw);
}

export function BaselineForm({ subject, initial, today, onSave }: {
  subject: BaselineSubject;
  initial?: BaselineResult;
  today: string;
  onSave: (values: {
    id?: string;
    subjectId: string;
    date: string;
    title: string;
    ratingScore: number | null;
    rawScore: number | null;
    maxRawScore: number | null;
    belowThreshold: boolean;
    partial: boolean;
    comment: string;
  }) => Promise<void>;
}) {
  return (
    <form className="grid gap-3 rounded-xl border border-border bg-secondary p-3 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void onSave({
        id: initial?.id,
        subjectId: subject.id,
        date: String(form.get("date") ?? ""),
        title: String(form.get("title") ?? ""),
        ratingScore: parseOptionalScore(form.get("ratingScore")),
        rawScore: parseOptionalScore(form.get("rawScore")),
        maxRawScore: parseOptionalScore(form.get("maxRawScore")),
        belowThreshold: form.get("belowThreshold") === "on",
        partial: form.get("partial") === "on",
        comment: String(form.get("comment") ?? ""),
      });
    }}>
      <label className="space-y-1 text-xs font-medium">Дата<Input name="date" type="date" defaultValue={initial?.date ?? today} required /></label>
      <label className="space-y-1 text-xs font-medium">Назва варіанта<Input name="title" defaultValue={initial?.title ?? ""} placeholder="Необов’язково" maxLength={200} /></label>
      <label className="space-y-1 text-xs font-medium">Рейтинговий бал 100–200<Input name="ratingScore" type="number" min={100} max={200} defaultValue={initial?.ratingScore ?? ""} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs font-medium">Тестовий бал<Input name="rawScore" type="number" min={0} defaultValue={initial?.rawScore ?? ""} /></label>
        <label className="space-y-1 text-xs font-medium">Максимум<Input name="maxRawScore" type="number" min={1} defaultValue={initial?.maxRawScore ?? ""} /></label>
      </div>
      <label className="flex items-center gap-2 text-xs"><input name="partial" type="checkbox" defaultChecked={initial?.partial ?? false} />Частковий тест</label>
      <label className="flex items-center gap-2 text-xs"><input name="belowThreshold" type="checkbox" defaultChecked={initial?.belowThreshold ?? false} />Пороговий бал не подолано</label>
      <label className="space-y-1 text-xs font-medium sm:col-span-2">Коментар (необов’язково)<textarea name="comment" defaultValue={initial?.comment ?? ""} maxLength={2000} rows={2} className="w-full rounded-xl border border-border bg-background p-2 text-sm" /></label>
      <p className="text-xs text-muted-foreground sm:col-span-2">Рейтинговий і тестовий бали зберігаються окремо. Перерахунок рейтингу не виконується.</p>
      <Button type="submit" className="sm:col-span-2">Зберегти результат</Button>
    </form>
  );
}
