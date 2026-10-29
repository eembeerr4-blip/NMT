"use server";

import { revalidatePath } from "next/cache";
import { lessonReadiness, publishReadinessError } from "@/lib/readiness";
import { canEditContent } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { userFacingError } from "@/lib/errors";
import {
  importResultMessage,
  type ContentPackageReport,
} from "@/lib/content-package";
import { recordAudit } from "@/server/audit-log";
import { getSessionUser } from "@/server/session";
import { applyContentPlan, reviewedPlan } from "@/server/content-import-core";

export type ContentImportState =
  | { ok: true; message: string; report: ContentPackageReport }
  | { ok: false; error: string; report?: ContentPackageReport };

async function editorUser() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Потрібен вхід до профілю." };
  if (!canEditContent(user)) return { ok: false as const, error: "Редагування спільних матеріалів доступне лише редактору." };
  return { ok: true as const, user };
}

export async function previewContentPackage(raw: string): Promise<ContentImportState> {
  const gate = await editorUser();
  if (!gate.ok) return gate;
  try {
    const reviewed = await reviewedPlan(raw, prisma);
    if (!reviewed.plan) return { ok: false, error: reviewed.error, report: reviewed.report };
    return { ok: true, message: "Пакет перевірено. Імпорт ще не виконано.", report: reviewed.report };
  } catch (error) {
    return { ok: false, error: userFacingError(error) };
  }
}

export async function importContentPackage(raw: string): Promise<ContentImportState> {
  const gate = await editorUser();
  if (!gate.ok) return gate;
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const reviewed = await reviewedPlan(raw, tx);
      if (!reviewed.plan) return { ok: false as const, error: reviewed.error, report: reviewed.report };
      await applyContentPlan(tx, reviewed.plan);
      const { counts } = reviewed.report;
      await recordAudit(gate.user, {
        action: "CONTENT_IMPORTED",
        entityType: "subject",
        entityId: reviewed.plan.subjectId,
        metadata: {
          imported: counts.topicsToCreate + counts.topicsToUpdate,
          skipped: counts.topicsSkipped + counts.questionsSkipped,
          count: counts.questionsToCreate + counts.questionsToUpdate,
          version: 1,
        },
      }, tx);
      return { ok: true as const, message: importResultMessage(reviewed.report), report: reviewed.report };
    }, { maxWait: 15000, timeout: 60000 });
    if (outcome.ok) revalidatePath("/", "layout");
    return outcome;
  } catch (error) {
    return { ok: false, error: userFacingError(error) };
  }
}

export async function publishLesson(topicId: string): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
  const gate = await editorUser();
  if (!gate.ok) return gate;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const topic = await tx.topic.findUnique({
        where: { id: topicId },
        include: { questions: true, videos: true, children: { select: { id: true } } },
      });
      if (!topic) return { ok: false as const, error: "Тему не знайдено." };
      if (topic.coverage === "READY" || topic.coverage === "VERIFIED") return { ok: true as const, message: "Урок уже опубліковано для учнів." };
      const readiness = lessonReadiness(topic);
      const blocked = publishReadinessError(readiness);
      if (blocked) return { ok: false as const, error: blocked };
      await tx.topic.update({ where: { id: topicId }, data: { coverage: "READY" } });
      await recordAudit(gate.user, { action: "LESSON_PUBLISHED", entityType: "topic", entityId: topicId }, tx);
      return { ok: true as const, message: "Урок опубліковано для учнів. Завдання лишаються чернетками, доки їх окремо не перевірять. Відео з’явиться після підтвердження посилання." };
    }, { timeout: 20000 });
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    return { ok: false, error: userFacingError(error) };
  }
}
