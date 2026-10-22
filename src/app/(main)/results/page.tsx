import {ListPagination,parseListPage} from "@/components/list-pagination";
import Link from "next/link";
import { EXAM_TYPE_LABEL } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ResultEditorDialog, ResultDeleteButton } from "@/components/result-editor-dialog";
import { requireUser } from "@/server/session";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ edit?: string; add?: string; q?:string;page?:string }> }) {
  const user = await requireUser();
  const params=await searchParams;const {edit,add}=params;const query=(params.q??"").trim().slice(0,120);const page=parseListPage(params.page);
  const where={userId:user.id,...(query?{OR:[{title:{contains:query}},{subject:{name:{contains:query}}}]}:{})};
  const results = await prisma.examResult.findMany({
    where, skip:(page-1)*20,take:20,
    include: { subject: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const total=await prisma.examResult.count({where});
  const current=edit?await prisma.examResult.findFirst({where:{id:edit,userId:user.id}}):null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Журнал результатів"
        description="Зберігайте результати діагностики, пробників і тестів окремо. Тестові та рейтингові бали показано окремо."
        action={<Button asChild><Link href="/results?add=1">Додати результат</Link></Button>}
      />
      <form className="flex flex-wrap items-end gap-2"><div className="grid min-w-[12rem] flex-1 gap-1.5"><Label htmlFor="results-search">Пошук результатів</Label><Input id="results-search" name="q" defaultValue={query} maxLength={120} placeholder="Назва або предмет" /></div><Button type="submit">Знайти</Button><Button asChild variant="ghost"><Link href="/results">Скинути</Link></Button></form>
      {results.length === 0 ? (
        <EmptyState title={query?"За цим запитом результатів немає":"Результатів ще немає"} text="Додайте результат пробника або дочекайтеся першої завершеної діагностики." />
      ) : (
        <div className="space-y-3">
          {results.map((result) => {
            const kind = result.id.startsWith("seed-") ? "Стартовий результат"
              : result.testType === "DIAGNOSTIC" ? "Діагностика"
              : result.testType === "MANUAL" ? "Внесено вручну"
              : "Результат тесту";
            return (
              <Card key={result.id} className="space-y-3 p-4 transition-colors hover:border-primary/30 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{result.subject.name}</h2>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{kind}</span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{EXAM_TYPE_LABEL[result.testType] ?? "Результат"}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatUk(result.date)} · {result.title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm"><Link href={`/results?edit=${encodeURIComponent(result.id)}`}>Виправити результат</Link></Button>
                    <ResultDeleteButton id={result.id} />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Score label="Тестовий бал" value={result.rawScore === null ? "Не вказано" : `${result.rawScore}${result.maxRawScore === null ? "" : ` / ${result.maxRawScore}`}`} />
                  <Score label="Рейтинговий бал" value={result.ratingScore === null ? "Не вказано" : String(result.ratingScore)} />
                  <Score label="У середньому" value={result.countsTowardAverage ? "Враховується" : "Не враховується"} />
                </div>
                {result.source || result.comment ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-muted-foreground">Деталі результату</summary>
                    {result.source ? <p className="mt-2 text-muted-foreground">Джерело: {result.source}</p> : null}
                    {result.comment ? <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{result.comment}</p> : null}
                  </details>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
      <ListPagination page={page} total={total} pathname="/results" params={{q:query}}/>
      {current || add ? (
        <ResultEditorDialog
          open
          initial={current ? {
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
          } : undefined}
        />
      ) : null}
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/70 px-3 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div>;
}
