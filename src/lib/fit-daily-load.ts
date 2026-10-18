export function fitDailyLoad<T extends { durationMin: number }>(slots: T[], dailyMinutes: number): T[] {
  if (dailyMinutes <= 0) return [];
  const total = slots.reduce((sum, slot) => sum + slot.durationMin, 0);
  const cap = Math.max(1, Math.floor(dailyMinutes));
  if (total <= cap) return slots;
  const positive = slots.filter((slot) => slot.durationMin > 0);
  let remaining = cap;
  let left = positive.length;
  return slots.map((slot) => {
    if (!slot.durationMin) return slot;
    const durationMin = left === 1 ? remaining : Math.min(remaining, Math.max(1, Math.floor(slot.durationMin * cap / total)));
    remaining -= durationMin;
    left -= 1;
    return { ...slot, durationMin };
  });
}
