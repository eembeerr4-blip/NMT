import { expect, it } from "vitest";
import type { RatingPoint } from "@/lib/scoring";
import { dashboardPeriod, dashboardSeries } from "./progress-data";

const point = (subjectId: string, date: string, ratingScore: number | null, extra: Partial<RatingPoint> = {}): RatingPoint => ({
  subjectId, date, ratingScore, partial: false, belowThreshold: false, countsTowardAverage: true, ...extra,
});

it("leaves the general score absent until every active subject has a full rating", () => {
  expect(dashboardSeries([point("math", "2026-10-01", 150)], ["math", "biology"])).toEqual([{ date: "2026-10-01", overall: null }]);
  expect(dashboardSeries([], [])).toEqual([]);
});
it("uses the latest existing full ratings without altering inputs or counting excluded records", () => {
  const rows = [point("biology", "2026-10-02", 170), point("math", "2026-10-01", 150), point("math", "2026-10-03", 180), point("math", "2026-10-04", 200, { partial: true }), point("biology", "2026-10-05", 200, { belowThreshold: true }), point("math", "2026-10-06", 200, { countsTowardAverage: false }), point("history", "2026-10-07", 199), point("math", "2026-10-08", null)];
  const copy = structuredClone(rows);
  expect(dashboardSeries(rows, ["math", "biology"])).toEqual([{ date: "2026-10-01", overall: null }, { date: "2026-10-02", overall: 160 }, { date: "2026-10-03", overall: 175 }]);
  expect(rows).toEqual(copy);
});
it("filters inclusive calendar days without inventing boundary points or including future results", () => {
  const rows = ["2026-09-19", "2026-09-20", "2026-10-12", "2026-10-13", "2026-10-19", "2026-10-20"].map(date => ({ date, overall: 150 }));
  expect(dashboardPeriod(rows, "2026-10-19", "7").map(row => row.date)).toEqual(["2026-10-13", "2026-10-19"]);
  expect(dashboardPeriod(rows, "2026-10-19", "30").map(row => row.date)).toEqual(["2026-09-20", "2026-10-12", "2026-10-13", "2026-10-19"]);
  expect(dashboardPeriod(rows, "2026-10-19", "all")).toHaveLength(5);
});
