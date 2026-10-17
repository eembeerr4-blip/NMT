import Link from "next/link";
import { EXAM_TYPE_LABEL } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ExamStartForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function ExamsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const [attempts, results] = await Promise.all([
    prisma.testAttempt.findMany({ where: { userId: user.id, test: { kind: "EXAM" } }, include: { test: { include: { subject: true } } }, orderBy: { startedAt: "desc" } }),
    prisma.examResult.findMany({ where: { userId: user.id }, include: { subject: true }, orderBy: { date: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Пробники" description="Повний пробник збирається лише з вашого перевіреного банку. Рейтинговий бал з'являється тільки якщо ви його ввели або якщо додано офіційну таблицю." action={<a className="text-sm underline" href="https://zno.osvita.ua/" target="_blank" rel="noreferrer">Відкрити zno.osvita.ua</a>} />
      <Card className="p-4 text-sm text-muted-foreground">{settings.format.note}</Card>
      <Card className="p-4"><ExamStartForm /></Card>
      <section className="space-y-2">
        <h2 className="font-medium">Історія проходжень у застосунку</h2>
        {attempts.length === 0 ? <p className="text-sm text-muted-foreground">Онлайн-пробників ще не було.</p> : attempts.map((attempt) => (
          <Link key={attempt.id} href={`/tests/${attempt.id}`} className="block rounded-2xl border border-border bg-card p-4">
            <div className="font-medium">{attempt.test.title}</div>
            <div className="text-sm text-muted-foreground">{attempt.test.subject?.name} · {attempt.status === "COMPLETED" ? `${attempt.correctCount}/${attempt.totalCount}` : "Незавершено"}</div>
          </Link>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Записані результати</h2>
        {results.map((result) => (
          <div key={result.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="font-medium">{formatUk(result.date)} · {result.subject.name}</div>
            <div className="text-muted-foreground">{EXAM_TYPE_LABEL[result.testType]} · {result.title} · {result.ratingScore ?? "рейтинг не вказано"}{result.rawScore !== null ? ` · тест ${result.rawScore}/${result.maxRawScore ?? "?"}` : ""}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
