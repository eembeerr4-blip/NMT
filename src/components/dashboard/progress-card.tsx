"use client";

import Link from "next/link";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { RatingChart } from "@/components/charts";
import { dashboardPeriod, type DashboardPeriod, type DashboardPoint } from "./progress-data";

export function DashboardProgress({ rows, today }: { rows: DashboardPoint[]; today: string }) {
  const [period, setPeriod] = useState<DashboardPeriod>("30");
  const visible = dashboardPeriod(rows, today, period);
  const last = visible.filter(point => point.overall !== null).at(-1)?.overall;
  return <section className="d01-panel d01-progress" aria-labelledby="dashboard-progress-title">
    <div className="d01-panel-heading">
      <h2 id="dashboard-progress-title">Мій прогрес</h2>
      <select aria-label="Період графіка прогресу" value={period} onChange={event => setPeriod(event.target.value as DashboardPeriod)}>
        <option value="7">За останні 7 днів</option><option value="30">За останні 30 днів</option><option value="all">Увесь період</option>
      </select>
    </div>
    {last != null ? <>
      <div className="d01-chart-label"><span>Загальний рейтинг</span><strong>{last.toLocaleString("uk-UA")} <span>балів</span></strong></div>
      <RatingChart rows={visible} subjectIds={["overall"]} compact />
    </> : <div className="d01-chart-empty">
      <TrendingUp aria-hidden="true" />
      <p>Недостатньо даних для загального рейтингу</p>
      <span>Потрібні повні результати з усіх обраних предметів.</span>
      <Link href="/results?add=1">Додати результат <span aria-hidden="true">→</span></Link>
    </div>}
  </section>;
}
