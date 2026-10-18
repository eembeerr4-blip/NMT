import { effectiveRole } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const AUDIT_ACTIONS = {
  SYSTEM_AUDIT_ENABLED: "Журнал увімкнено",
  AUTH_LOGIN_FAILED: "Невдала спроба входу",
  AUTH_LOGIN: "Вхід до профілю", AUTH_LOGOUT: "Вихід із профілю",
  VIDEO_ADDED: "Додано або підтверджено відео", VIDEO_UPDATED: "Оновлено відео",
  VIDEO_DELETED: "Видалено відео", VIDEO_PRIMARY: "Змінено основне відео",
  VIDEO_REVIEWED: "Змінено статус відео", VIDEO_ROLE: "Змінено тип відео",
  VIDEO_SEARCH: "Додано пропозиції відео",
  QUESTION_SAVED: "Збережено завдання", QUESTION_REMOVED: "Завдання прибрано з банку",
  QUESTIONS_IMPORTED: "Імпортовано завдання", QUESTIONS_GENERATED: "Збережено AI-чернетки",
  QUESTION_VERIFIED: "Змінено перевірку завдання",
  SUBJECT_UPDATED: "Оновлено предмет",
  TOPIC_CREATED: "Створено тему", TOPIC_UPDATED: "Оновлено тему",
  LESSON_SAVED: "Збережено матеріал уроку", USER_ROLE_CHANGED: "Змінено роль профілю",
  SETTINGS_SAVED: "Збережено налаштування", SCHEDULE_SAVED: "Збережено розклад",
  SCHEDULE_RESET: "Відновлено стандартний розклад", FORMAT_SAVED: "Змінено формат і шкали",
  INTEGRATIONS_SAVED: "Збережено налаштування інтеграцій",
  BACKUP_CREATED: "Підготовлено резервну копію", BACKUP_RESTORED: "Відновлено резервну копію",
  QUESTIONS_EXPORTED: "Підготовлено експорт завдань",
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;
export type AuditActor = { id: string; firstName?: string; nickname?: string; role?: string };
export type AuditEvent = { action: AuditAction; entityType: string; entityId?: string; metadata?: unknown };

// Only explicit non-sensitive facts may be serialized. Never persist an action's raw arguments.
export function safeAuditMetadata(value: unknown): Record<string, string | number | string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: Record<string, string | number | string[]> = {};
  for (const key of ["count", "imported", "skipped", "version"] as const) {
    if (typeof raw[key] === "number" && Number.isSafeInteger(raw[key]) && raw[key] >= 0) result[key] = raw[key];
  }
  for (const key of ["role", "previousRole"] as const) {
    if (typeof raw[key] === "string" && ["STUDENT", "EDITOR", "ADMIN", "OWNER"].includes(raw[key])) result[key] = raw[key];
  }
  const allowedFields = new Set(["title", "summary", "formulas", "status", "role", "lesson", "options", "verificationStatus", "url", "video", "schedule", "format", "preferences", "integrations"]);
  if (Array.isArray(raw.fields)) result.fields = raw.fields.filter((field): field is string => typeof field === "string" && allowedFields.has(field));
  return result;
}

export function auditData(actor: AuditActor | null, event: AuditEvent) {
  return {
    actorId: actor?.id ?? null,
    actorName: actor ? [actor.firstName, actor.nickname ? `@${actor.nickname}` : ""].filter(Boolean).join(" ") || "Профіль" : "Система",
    actorRole: actor ? effectiveRole(actor) : "SYSTEM",
    action: event.action, entityType: event.entityType, entityId: event.entityId ?? null,
    summary: AUDIT_ACTIONS[event.action], metadataJson: JSON.stringify(safeAuditMetadata(event.metadata)),
  };
}

export async function recordAudit(actor: AuditActor | null, event: AuditEvent, tx: Prisma.TransactionClient = prisma) {
  return tx.auditLog.create({ data: auditData(actor, event) });
}

export async function auditedWrite<T extends { ok: boolean; id?: string }>(
  actor: AuditActor, event: AuditEvent, change: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await change(tx);
    if (result.ok) await recordAudit(actor, { ...event, entityId: result.id ?? event.entityId }, tx);
    return result;
  }, { timeout: 20000 });
}
