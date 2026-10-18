import { recordAudit } from "@/server/audit-log";
import { getSessionUser } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { canEditContent } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Потрібен вхід до профілю." }, { status: 401 });
  if (!canEditContent(user)) return Response.json({ error: "Експорт банку запитань доступний лише редактору." }, { status: 403 });
  const questions = await prisma.question.findMany({ include: { options: true }, orderBy: { createdAt: "asc" } });
  await recordAudit(user, {action:"QUESTIONS_EXPORTED",entityType:"question",metadata:{count:questions.length}});
  return Response.json(questions, {
    headers: { "Content-Disposition": "attachment; filename=nmt-questions.json" },
  });
}
