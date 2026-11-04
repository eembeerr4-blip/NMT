"use client";

import { useMemo, useState } from "react";
import { SUBJECTS } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { formatDelta } from "@/lib/scoring";
import { Card } from "@/components/ui";

export type DynamicsResult = {
  date: string;
  ratingScore: number;
  title: string;
  testType: string;
};

export function ResultsDynamicsSection({
  subjects,
  resultsBySubject,
}: {
  subjects: string[];
  resultsBySubject: Record<string, DynamicsResult[]>;
}) {
  const [subjectId, setSubjectId] = useState(subjects[0] ?? "math");
  const rows = useMemo(
    () => (resultsBySubject[subjectId] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [resultsBySubject, subjectId],
  );
  const subject = SUBJECTS.find((item) => item.id === subjectId);
  const latest = rows.at(-1);
  const previous = rows.length > 1 ? rows.at(-2) : undefined;
  const delta = latest && previous ? latest.ratingScore - previous.ratingScore : null;

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Динаміка результатів</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Рейтингові бали повних результатів за обраним предметом. Тестові бали окремо.
          </p>
        </div>
        {subjects.length > 1 ? (
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-muted-foreground">Предмет</span>
            <select
              className="h-10 min-w-[12rem] rounded-lg border border-border bg-card px-3"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              {subjects.map((id) => (
                <option key={id} value={id}>{SUBJECTS.find((item) => item.id === id)?.name ?? id}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {!rows.length ? (
        <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          Для {subject?.name ?? "цього предмета"} ще немає повних результатів із рейтинговим балом у вибраному періоді.
        </p>
      ) : rows.length === 1 && latest ? (
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">{formatUk(latest.date)} · {latest.title}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{latest.ratingScore}</p>
          <p className="mt-1 text-sm text-muted-foreground">Один запис — порівняння з’явиться після наступного повного результату.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Останній бал" value={String(latest?.ratingScore ?? "—")} />
          <Stat label="Попередній" value={String(previous?.ratingScore ?? "—")} />
          <Stat label="Зміна" value={delta === null ? "—" : formatDelta(delta)} />
        </div>
      )}

      {rows.length > 1 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {[...rows].reverse().map((row) => (
            <li key={`${row.date}-${row.title}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{formatUk(row.date)}</p>
                <p className="text-muted-foreground">{row.title}</p>
              </div>
              <strong className="tabular-nums">{row.ratingScore}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
