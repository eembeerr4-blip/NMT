/** Only keys emitted by buildSlotsForDate belong to the automatic planner. */
export function autoPlanKey(weekday: number, slot: number) {
  return `d${weekday}-s${slot}`;
}

export function isAutoPlanned(task: { templateKey: string | null; movedFromId?: string | null }) {
  const match=/^d([0-6])-s(\d+)$/.exec(task.templateKey??"");
  return !task.movedFromId && Boolean(match && task.templateKey===autoPlanKey(Number(match[1]),Number(match[2])));
}
