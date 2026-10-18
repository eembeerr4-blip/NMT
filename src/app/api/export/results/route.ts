import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Потрібен вхід до профілю." }, { status: 401 });
  const results = await prisma.examResult.findMany({ where: { userId: user.id }, include: { subject: true }, orderBy: { date: "asc" } });
  const header = ["date", "subject", "type", "title", "raw", "max", "rating", "partial", "counts", "comment"];
  const lines = results.map((result) => [
    result.date.toISOString().slice(0, 10),
    result.subject.name,
    result.testType,
    result.title,
    result.rawScore ?? "",
    result.maxRawScore ?? "",
    result.ratingScore ?? "",
    result.partial ? "yes" : "no",
    result.countsTowardAverage ? "yes" : "no",
    result.comment,
  ].map(csv).join(","));
  return new Response("\uFEFF" + [header.join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=nmt-results.csv",
    },
  });
}

function csv(value: string | number) {
  const safe = typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value;
  const text = String(safe).replaceAll('"', '""');
  return `"${text}"`;
}
