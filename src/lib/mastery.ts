export function reviewIntervals(correct: number, total: number, highMin: number, midMin: number, mistakeRepeats: number) {
  const safeTotal = Math.max(1, total);
  const high = Math.max(1, Math.round((highMin / 12) * safeTotal));
  const mid = Math.max(0, Math.round((midMin / 12) * safeTotal));
  if (mistakeRepeats >= 2 || correct < mid) return [1, 3, 7];
  if (correct >= high) return [7, 21, 45];
  return [1, 7, 30];
}

export function learningStatus(correct: number, total: number, highMin: number, midMin: number) {
  const safeTotal = Math.max(1, total);
  const high = Math.max(1, Math.round((highMin / 12) * safeTotal));
  const mid = Math.max(0, Math.round((midMin / 12) * safeTotal));
  if (correct >= high) return "MASTERED";
  if (correct >= mid) return "NEEDS_REVIEW";
  return "IN_PROGRESS";
}
