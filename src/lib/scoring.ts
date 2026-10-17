export type RatingPoint = {
  subjectId: string;
  date: string;
  ratingScore: number | null;
  partial: boolean;
  belowThreshold: boolean;
  countsTowardAverage: boolean;
};

export type AverageResult = {
  value: number | null;
  label: string;
};

const INSUFFICIENT = "Недостатньо даних";

export function countsAsRating(point: Pick<RatingPoint, "ratingScore" | "partial" | "belowThreshold" | "countsTowardAverage">) {
  return (
    point.countsTowardAverage &&
    !point.partial &&
    !point.belowThreshold &&
    point.ratingScore !== null &&
    Number.isFinite(point.ratingScore)
  );
}

export function latestRatingBySubject(points: RatingPoint[], subjectIds: string[]) {
  const sorted = [...points]
    .filter(countsAsRating)
    .sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, RatingPoint>();
  for (const point of sorted) {
    if (subjectIds.includes(point.subjectId)) map.set(point.subjectId, point);
  }
  return map;
}

export function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function averageOfLatestFull(points: RatingPoint[], subjectIds: string[]): AverageResult {
  const latest = latestRatingBySubject(points, subjectIds);
  if (subjectIds.some((id) => !latest.has(id))) {
    return { value: null, label: INSUFFICIENT };
  }
  const value = mean(subjectIds.map((id) => latest.get(id)!.ratingScore!));
  return { value: value === null ? null : round1(value), label: value === null ? INSUFFICIENT : "" };
}

export function averageForSubject(points: RatingPoint[], subjectId: string): AverageResult {
  const values = points.filter((point) => point.subjectId === subjectId && countsAsRating(point)).map((point) => point.ratingScore!);
  const value = mean(values);
  return { value: value === null ? null : round1(value), label: value === null ? INSUFFICIENT : "" };
}

export function averageForMonth(points: RatingPoint[], monthPrefix: string): AverageResult {
  const values = points
    .filter((point) => point.date.startsWith(monthPrefix) && countsAsRating(point))
    .map((point) => point.ratingScore!);
  const value = mean(values);
  return { value: value === null ? null : round1(value), label: value === null ? INSUFFICIENT : "" };
}

export function changeFromPrevious(points: RatingPoint[], subjectId: string) {
  const series = points
    .filter((point) => point.subjectId === subjectId && countsAsRating(point))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (series.length < 2) return { value: null as number | null, label: INSUFFICIENT };
  const delta = series[series.length - 1].ratingScore! - series[series.length - 2].ratingScore!;
  return { value: delta, label: "" };
}

export function changeFromInitial(points: RatingPoint[], subjectId: string) {
  const series = points
    .filter((point) => point.subjectId === subjectId && countsAsRating(point))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (series.length < 2) return { value: null as number | null, label: INSUFFICIENT };
  const delta = series[series.length - 1].ratingScore! - series[0].ratingScore!;
  return { value: delta, label: "" };
}

export function overallChange(points: RatingPoint[], subjectIds: string[], mode: "previous" | "initial") {
  const deltas: number[] = [];
  for (const subjectId of subjectIds) {
    const result = mode === "previous" ? changeFromPrevious(points, subjectId) : changeFromInitial(points, subjectId);
    if (result.value === null) return { value: null as number | null, label: INSUFFICIENT };
    deltas.push(result.value);
  }
  const value = mean(deltas);
  return { value: value === null ? null : round1(value), label: "" };
}

export type ScaleTable = Record<string, Record<string, { raw: number; rating: number }[]>>;

export function convertRawToRating(scales: ScaleTable, year: number, subjectId: string, raw: number) {
  const rows = scales[String(year)]?.[subjectId];
  if (!rows?.length) return null;
  return rows.find((row) => row.raw === raw)?.rating ?? null;
}

export function masteryDecision(correct: number, total: number, highMin: number, midMin: number) {
  if (total <= 0) return "IN_PROGRESS" as const;
  const high = Math.max(1, Math.round((highMin / 12) * total));
  const mid = Math.max(0, Math.round((midMin / 12) * total));
  if (correct >= high) return "MASTERED" as const;
  if (correct >= mid) return "NEEDS_REVIEW" as const;
  return "REPEAT_THEORY" as const;
}

export function weekCompletion(tasks: { status: string; durationMin: number; optional: boolean; kind: string }[]) {
  const required = tasks.filter((task) => !task.optional && task.kind !== "rest" && task.status !== "MOVED");
  const planned = required.reduce((sum, task) => sum + task.durationMin, 0);
  if (planned <= 0) return 0;
  const done = required.filter((task) => task.status === "DONE").reduce((sum, task) => sum + task.durationMin, 0);
  return Math.round((done / planned) * 100);
}

export function computeStreak(activeDates: string[], today: string) {
  const active = new Set(activeDates);
  let cursor = today;
  if (!active.has(cursor)) cursor = shift(cursor, -1);
  let streak = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const date = keyToDate(cursor);
    if (active.has(cursor)) {
      streak += 1;
      cursor = shift(cursor, -1);
      continue;
    }
    if (date.getDay() === 0) {
      cursor = shift(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}

function keyToDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shift(key: string, days: number) {
  const date = keyToDate(key);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDelta(value: number | null) {
  if (value === null) return "Недостатньо даних";
  if (value > 0) return `+${round1(value)}`;
  return String(round1(value));
}
