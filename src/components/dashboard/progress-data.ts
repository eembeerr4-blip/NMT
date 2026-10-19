import { averageOfLatestFull, countsAsRating, type RatingPoint } from "@/lib/scoring";
import { addDateKeys } from "@/lib/dates";

export type DashboardPoint = { date: string; overall: number | null };
export type DashboardPeriod = "7" | "30" | "all";

/** Presentation of existing scores; never converts raw marks or fills missing subjects. */
export function dashboardSeries(points: RatingPoint[], subjectIds: string[]): DashboardPoint[] {
  const eligible = points.filter(point => subjectIds.includes(point.subjectId) && countsAsRating(point));
  const dates = [...new Set(eligible.map(point => point.date))].sort();
  return dates.map(date => ({
    date,
    overall: averageOfLatestFull(eligible.filter(point => point.date <= date), subjectIds).value,
  }));
}

export function dashboardPeriod(rows: DashboardPoint[], today: string, period: DashboardPeriod) {
  const from = period === "all" ? null : addDateKeys(today, -(Number(period) - 1));
  return rows.filter(row => row.date <= today && (!from || row.date >= from));
}
