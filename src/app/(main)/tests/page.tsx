import Link from "next/link";
import { ArrowRight, ClipboardList, History, Play } from "lucide-react";
import { Card, EmptyState, PageHeader, Button, Badge } from "@/components/ui";
import { StartTestSet } from "@/components/test-set-controls";
import { prisma } from "@/lib/prisma";
import { testPublication } from "@/lib/test-publication";
import { requireUser } from "@/server/session";

export default async function TestsPage() {
  const user = await requireUser();
  const active = user.subjects.filter(subject => subject.active).map(subject => subject.subjectId);
  const [attempts, published] = await Promise.all([
    prisma.testAttempt.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 30, include: { test: { include: { topic: true, subject: true } } } }),
    prisma.test.findMany({ where: { subjectId: { in: active }, configJson: { contains: '"publication":"PUBLISHED"' } }, include: { subject: true, _count: { select: { questions: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const available = published.filter(set => testPublication(set.configJson) === "PUBLISHED");
  const unfinished = attempts.filter(attempt => attempt.status !== "COMPLETED");
  const completed = attempts.filter(attempt => attempt.status === "COMPLETED");
  return <div className="d05-testing d05-test-catalogue">
    <div className="d05-page-heading"><PageHeader title="Мої тести" description="Продовжуйте зі збереженої відповіді або оберіть нову перевірку знань." action={<Button asChild><Link href="/subjects">Обрати тему<ArrowRight aria-hidden="true" /></Link></Button>} /></div>
    <nav className="d05-catalogue-nav" aria-label="Розділи тестування"><Link href="/exams">Пробники →</Link><Link href="/results">Записані результати →</Link></nav>
    <section aria-labelledby="d05-unfinished"><div className="d05-section-heading"><h2 id="d05-unfinished"><Play size={18} aria-hidden="true" />Продовжити тест</h2><span>{unfinished.length}</span></div>
      {unfinished.length ? <div className="d05-attempt-list">{unfinished.map(attempt => <Link className="d05-attempt-row" key={attempt.id} href={`/tests/${attempt.id}`}><span className="d05-test-icon"><ClipboardList aria-hidden="true" /></span><div><span className="d05-eyebrow">{attempt.test.subject?.name ?? "Кілька предметів"} · {kindLabel(attempt.test.kind)}</span><h3>{attempt.test.title}</h3><p>Чернетка збережена. Продовжуйте цю саму спробу.</p></div><span className="d05-row-action">Продовжити<ArrowRight size={16} aria-hidden="true" /></span></Link>)}</div> : <EmptyState title="Немає незавершених спроб" text="Коли розпочнете тест, тут можна буде повернутися до нього." />}
    </section>
    <section aria-labelledby="d05-available"><div className="d05-section-heading"><h2 id="d05-available"><ClipboardList size={18} aria-hidden="true" />Доступні набори</h2><span>{available.length}</span></div>
      {available.length ? <div className="d05-available-grid">{available.map(set => <Card className="d05-available-card" key={set.id}><Badge>{set.subject?.name ?? "Кілька предметів"}</Badge><h3>{set.title}</h3><p>{set._count.questions} запитань · {kindLabel(set.kind)} · {set.timeLimitSec ? `${set.timeLimitSec / 60} хв` : "Без ліміту часу"}</p><StartTestSet id={set.id} /></Card>)}</div> : <EmptyState title="Опублікованих наборів поки немає" text="Тематична практика доступна на сторінці уроку, якщо в темі є перевірені завдання." action={<Button asChild variant="outline"><Link href="/subjects">До предметів</Link></Button>} />}
    </section>
    <section aria-labelledby="d05-completed"><div className="d05-section-heading"><h2 id="d05-completed"><History size={18} aria-hidden="true" />Завершені спроби</h2><span>{completed.length}</span></div>
      {completed.length ? <div className="d05-attempt-list">{completed.map(attempt => <Link className="d05-attempt-row" key={attempt.id} href={`/tests/${attempt.id}`}><span className="d05-test-icon"><ClipboardList aria-hidden="true" /></span><div><span className="d05-eyebrow">{attempt.test.subject?.name ?? "Кілька предметів"} · {kindLabel(attempt.test.kind)}</span><h3>{attempt.test.title}</h3><p>{attempt.correctCount ?? 0} правильних відповідей із {attempt.totalCount ?? 0}{attempt.pendingCount ? ` · Очікують перевірки: ${attempt.pendingCount}` : " · Перевірено"}</p></div><span className="d05-row-action">Результат<ArrowRight size={16} aria-hidden="true" /></span></Link>)}</div> : <EmptyState title="Завершених спроб ще немає" text="Після завершення тесту тут з’являться відповіді та їхній розбір." />}
    </section>
    <p className="d05-list-limit">Показано до 30 останніх спроб і до 100 опублікованих наборів для ваших активних предметів.</p>
  </div>;
}
function kindLabel(kind: string) { return kind === "EXAM" ? "Пробник" : kind === "DIAGNOSTIC" ? "Діагностика" : kind === "TOPIC" ? "Тематична практика" : "Тест"; }
