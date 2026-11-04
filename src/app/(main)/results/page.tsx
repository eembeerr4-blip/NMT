import {ListPagination,parseListPage} from "@/components/list-pagination";
import Link from "next/link";
import { EXAM_TYPE_LABEL } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ResultEditorDialog } from "@/components/result-editor-dialog";
import { ResultRowMenu } from "@/components/result-row-menu";
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
            const dateLabel = formatUk(result.date);
            const editHref = `/results?edit=${encodeURIComponent(result.id)}`;
            const rating = result.ratingScore === null ? "—" : String(result.ratingScore);
            const raw = result.rawScore === null ? "—" : `${result.rawScore}${result.maxRawScore === null ? "" : ` / ${result.maxRawScore}`}`;
            return (
              <Card key={result.id} className="p-4 transition-colors hover:border-primary/30 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="font-semibold">{result.subject.name}</h2>
                      <span className="text-sm text-muted-foreground">{dateLabel}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{result.source.includes("SELF_REPORTED")?"ZNO Online · SELF_REPORTED":kind}</span>
                    </div>
                    <p className="text-sm tabular-nums">
                      Рейтинг: <strong>{rating}</strong>
                      <span className="mx-2 text-muted-foreground">·</span>
                      Тест: <strong>{raw}</strong>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{result.title}</p>
                  </div>
                  {result.source.includes("SELF_REPORTED")?<Link className="text-sm underline" href="/exams">Виправити самооцінку</Link>:<ResultRowMenu id={result.id} editHref={editHref} subjectName={result.subject.name} dateLabel={dateLabel} />}
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground">Деталі результату</summary>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>Тип: {EXAM_TYPE_LABEL[result.testType] ?? result.testType}</p>
                    <p>У середньому: {result.countsTowardAverage ? "враховується" : "не враховується"}</p>
                    {result.id.startsWith("seed-") ? (
                      <p className="text-xs text-warning-text">Стартовий запис можна виправити або видалити через меню «⋯», якщо дані введені помилково.</p>
                    ) : null}
                    {result.source ? <p>Джерело: {result.source}</p> : null}
                    {result.comment ? <p className="whitespace-pre-wrap">{result.comment}</p> : null}
                  </div>
                </details>
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

