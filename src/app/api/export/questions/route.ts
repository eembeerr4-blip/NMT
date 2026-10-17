import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const questions = await prisma.question.findMany({ include: { options: true }, orderBy: { createdAt: "asc" } });
  return Response.json(questions, {
    headers: { "Content-Disposition": "attachment; filename=nmt-questions.json" },
  });
}
