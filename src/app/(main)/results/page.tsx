import Link from "next/link";
import { EXAM_TYPE_LABEL } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ResultForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { deleteExamResult } from "@/server/actions";
import { requireUser } from "@/server/session";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const results = await prisma.examResult.findMany({ where: { userId: user.id }, include: { subject: true }, orderBy: { date: "asc" } });
  const current = results.find((result) => result.id === edit);
  return (
    <div className="space-y-6">
      <PageHeader title="Журнал результатів" description="Кожен запис зберігається окремо. Новий результат не замінює попередній." />
      <div className="space-y-2">
        {results.map((result) => (
          <Card key={result.id} className="p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">{formatUk(result.date)} · {result.subject.name}</div>
                <div className="text-muted-foreground">{EXAM_TYPE_LABEL[result.testType]} · {result.title}</div>
                <div className="mt-1">Тестовий бал: {result.rawScore === null ? "немає даних" : `${result.rawScore}/${result.maxRawScore ?? "?"}`} · Рейтинг: {result.ratingScore ?? "немає даних"}</div>
                {result.comment ? <p className="mt-1">{result.comment}</p> : null}
                <p className="text-xs text-muted-foreground">{result.countsTowardAverage ? "Входить у середній рейтинговий бал" : "Не входить у середній рейтинговий бал"}</p>
              </div>
              <div className="flex gap-3">
                <Link href={`/results?edit=${result.id}#add`} className="underline">Редагувати</Link>
                {result.id.startsWith("seed-") ? null : (
                  <form action={async () => { "use server"; await deleteExamResult(result.id); }}><button className="underline" type="submit">Видалити</button></form>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card id="add" className="p-4">
        <h2 className="mb-3 font-medium">{current ? "Редагувати запис" : "Додати результат"}</h2>
        <ResultForm key={current?.id ?? "new"} initial={current ? {
          id: current.id,
          date: current.date.toISOString().slice(0, 10),
          subjectId: current.subjectId as "math",
          testType: current.testType as "MANUAL",
          title: current.title,
          source: current.source,
          rawScore: current.rawScore,
          maxRawScore: current.maxRawScore,
          ratingScore: current.ratingScore,
          belowThreshold: current.belowThreshold,
          partial: current.partial,
          countsTowardAverage: current.countsTowardAverage,
          durationMin: current.durationSec ? Math.round(current.durationSec / 60) : null,
          errorCount: current.errorCount,
          comment: current.comment,
        } : undefined} />
      </Card>
    </div>
  );
}
