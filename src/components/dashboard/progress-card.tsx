"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { formatDelta } from "@/lib/scoring";
import { RatingChart } from "@/components/charts";
import { dashboardPeriod, type DashboardPeriod, type DashboardPoint } from "./progress-data";

export type DashboardSubjectSummary = {
  id: string;
  name: string;
  latestRating: number | null;
  mastered: number;
  total: number;
};

export function DashboardProgress({
  rows,
  today,
  subjects,
}: {
  rows: DashboardPoint[];
  today: string;
  subjects: DashboardSubjectSummary[];
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("30");
  const visible = useMemo(() => dashboardPeriod(rows, today, period), [rows, today, period]);
  const rated = visible.filter((point) => point.overall !== null);
  const last = rated.at(-1)?.overall ?? null;
  const previous = rated.length > 1 ? rated.at(-2)?.overall ?? null : null;
  const delta = last !== null && previous !== null ? last - previous : null;

  return (
    <section className="d01-panel d01-progress" aria-labelledby="dashboard-progress-title">
      <div className="d01-panel-heading">
        <h2 id="dashboard-progress-title">Мій прогрес</h2>
        <select
          aria-label="Період графіка прогресу"
          value={period}
          onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}
        >
          <option value="7">За останні 7 днів</option>
          <option value="30">За останні 30 днів</option>
          <option value="all">Увесь період</option>
        </select>
      </div>

      {last == null ? (
        <div className="d01-chart-empty">
          <TrendingUp aria-hidden="true" />
          <p>Недостатньо даних для загального рейтингу</p>
          <span>Потрібні повні результати з усіх обраних предметів.</span>
          <Link href="/results?add=1">Додати результат <span aria-hidden="true">→</span></Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <p className="text-xs text-muted-foreground">Середній рейтинговий бал (останній розрахунок)</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {last.toLocaleString("uk-UA", { maximumFractionDigits: 1 })}
              <span className="ml-2 text-base font-medium text-muted-foreground">балів</span>
            </p>
            {delta !== null ? (
              <p className="mt-1 text-sm text-muted-foreground">Зміна від попереднього періоду: {formatDelta(delta)}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Порівняння з’явиться після другого повного результату.</p>
            )}
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {subjects.map((subject) => {
              const percent = subject.total ? Math.round((subject.mastered / subject.total) * 100) : null;
              return (
                <li key={subject.id} className="rounded-xl border border-border bg-background/30 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{subject.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {subject.latestRating ?? "—"}
                    </span>
                  </div>
                  {percent !== null ? (
                    <p className="mt-1 text-xs text-muted-foreground">{subject.mastered} із {subject.total} тем · {percent}%</p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {rated.length >= 3 ? <RatingChart rows={visible} subjectIds={["overall"]} compact /> : null}
        </div>
      )}
    </section>
  );
}
