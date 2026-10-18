/** Only keys emitted by buildSlotsForDate belong to the automatic planner. */
export function isAutoPlanned(task: { templateKey: string | null; movedFromId?: string | null }) {
  return !task.movedFromId && /^d[0-6]-s\d+$/.test(task.templateKey ?? "");
}
