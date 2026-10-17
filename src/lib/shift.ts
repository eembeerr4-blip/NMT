export function relocationMode(task: { templateKey: string | null; movedFromId: string | null }) {
  if (task.movedFromId || task.templateKey?.startsWith("moved-")) return "update" as const;
  return "successor" as const;
}
