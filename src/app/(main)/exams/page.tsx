import Link from "next/link";
import { SUBJECTS } from "@/lib/constants";
import { formatUk } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ExamStartForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";
import { getSettings, syncPlan } from "@/server/sync";
import { externalSubjects, practiceSchedule, variantsFor, znoCatalog, variantCatalogMessage } from "@/lib/external-practice";
import { externalAssignments, externalPracticeReady } from "@/server/external-practice";
import { assignmentView } from "@/server/external-practice-view";
import { ExternalPracticeCard, PracticeScheduleForm } from "@/components/external-practice";
import { ExternalTopicCatalog } from "@/components/external-topic-catalog";
import { learnerQuestionAvailable } from "@/lib/test-access";

export default async function ExamsPage() {
  const user=await requireUser();
  const settings=await getSettings(user.id);
  if(practiceSchedule(settings.schedule).enabled) await syncPlan(user.id);
  const [assignments,ready,attempts,results,bank]=await Promise.all([
    externalAssignments(user.id),externalPracticeReady(),
    prisma.testAttempt.findMany({where:{userId:user.id,test:{kind:"EXAM"}},include:{test:true},orderBy:{startedAt:"desc"}}),
    prisma.examResult.findMany({where:{userId:user.id},include:{subject:true},orderBy:{date:"desc"}}),
    prisma.question.findMany({where:{subjectId:{in:[...externalSubjects]},verificationStatus:"VERIFIED"},include:{topic:true}}),
  ]);
  const pending=assignments.filter(a=>a.status==="PLANNED").sort((a,b)=>a.task.dateKey.localeCompare(b.task.dateKey));
  const available=bank.filter(learnerQuestionAvailable);
  return <div className="d05-testing d05-exams min-w-0 space-y-6">
    <PageHeader title="Пробники НМТ" description="NMT Academy — автоматична перевірка. ZNO Online — конкретні зовнішні варіанти та добровільний запис власного результату."/>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Найближче тренування</h2>{pending[0]?<ExternalPracticeCard assignment={assignmentView(pending[0])}/>:<Card className="p-4">Немає активного призначення. Оберіть навчальні дні нижче; пропущені тренування доступні до результату або явного пропуску.</Card>}</section>
    <section className="grid min-w-0 gap-4 lg:grid-cols-2"><Card className="min-w-0 space-y-3 p-4"><h2 className="text-lg font-semibold">Оберіть спосіб · NMT Academy</h2><p className="text-sm text-muted-foreground">Внутрішня практика: автоматичне оцінювання, відповіді, розбір і повторення. Короткий тест із банку не є повним НМТ.</p>{externalSubjects.map(id=><p key={id} className="text-sm">{SUBJECTS.find(s=>s.id===id)?.name}: {available.filter(q=>q.subjectId===id).length} доступних перевірених завдань</p>)}<ExamStartForm allowedSubjectIds={[...externalSubjects]}/></Card><Card className="min-w-0 space-y-3 p-4"><h2 className="text-lg font-semibold">ZNO Online · Освіта.ua</h2><p className="text-sm">Тренувальні варіанти НМТ-2027 за класифікацією провайдера. Це не підтвердження офіційного формату НМТ-2027.</p><p className="text-sm text-muted-foreground">Номер зростає лише після внесення результату або явного пропуску. Кожний предмет має незалежну чергу. Відкриття сайту нічого не зараховує.</p><Link className="underline" href="#variants">Обрати конкретний варіант</Link><p className="text-xs text-muted-foreground">Провайдер може вимагати власний обліковий запис або підписку. Обмеження не обходимо.</p></Card></section>
    <PracticeScheduleForm config={practiceSchedule(settings.schedule)} studyDays={settings.studyDays} ready={ready}/>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Мої призначення та результати ZNO Online</h2>{assignments.filter(row=>row.id!==pending[0]?.id).map(row=><ExternalPracticeCard key={row.id} assignment={assignmentView(row)}/>)}{!assignments.length?<p className="text-sm text-muted-foreground">Призначень ще немає.</p>:null}{assignments.some(a=>a.status==="PAUSED")?<p role="status" className="text-sm">Частина призначень очікує вільного навчального дня. Перевірте дні та денний ліміт.</p>:null}</section>
    <section id="variants" className="space-y-3"><h2 className="text-lg font-semibold">Всі доступні варіанти</h2><p className="text-xs text-muted-foreground">Публічні сторінки перевірено {znoCatalog.verifiedAt}. Кількість завдань не дорівнює максимальному тестовому балу.</p>{externalSubjects.map(id=><details key={id} className="min-w-0 rounded-xl border border-border p-4"><summary className="cursor-pointer font-medium">{SUBJECTS.find(s=>s.id===id)?.name} · {variantsFor(id).length} варіантів</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{variantsFor(id).map(v=>{const history=assignments.find(a=>a.subjectId===id&&a.variantNumber===v.number);return <a key={v.number} href={v.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border p-3 text-sm underline">Пройти варіант №{v.number} на ZNO Online · {v.questionCount} завдань{history?` · ${history.status==="COMPLETED"?"виконано":history.status==="SKIPPED"?"явно пропущено":"призначено"}`:" · доступний"}</a>;})}</div><p className="mt-3 text-sm text-muted-foreground">{variantCatalogMessage(id,assignments)}</p></details>)}</section>
    <ExternalTopicCatalog/>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Архів тестів та інші режими ZNO Online</h2>{externalSubjects.map(id=><details className="rounded-xl border border-border p-4" key={id}><summary className="cursor-pointer">{SUBJECTS.find(s=>s.id===id)?.name}</summary><div className="mt-3 flex flex-col gap-2 text-sm"><a className="underline" href={znoCatalog.categories[id].themes} target="_blank" rel="noopener noreferrer">Каталог завдань за темами</a><a className="underline" href={znoCatalog.categories[id].random10!} target="_blank" rel="noopener noreferrer">Десятка випадкових завдань</a><a className="underline" href={znoCatalog.categories[id].all!} target="_blank" rel="noopener noreferrer">Усі завдання з предмета</a><a className="underline" href={znoCatalog.categories[id].training} target="_blank" rel="noopener noreferrer">Каталог тренувальних НМТ-2027</a><h3 className="font-medium">Реальні варіанти минулих років (2026)</h3>{znoCatalog.categories[id].archive.map(a=><a className="underline" key={a.url} href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>)}</div></details>)}</section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Історія моїх результатів</h2>{attempts.map(a=><Link className="block rounded-xl border border-border p-3 text-sm" key={a.id} href={`/tests/${a.id}`}>{a.test.title} · NMT Academy · {a.status==="COMPLETED"?`${a.correctCount}/${a.totalCount}`:"Незавершено"}</Link>)}{results.map(r=><Card className="p-3 text-sm" key={r.id}>{formatUk(r.date)} · {r.subject.name} · {r.title}<p>{r.source.includes("SELF_REPORTED")?"ZNO Online · SELF_REPORTED · внесено самостійно":r.source||"Ручний запис"} · тест {r.rawScore??"—"}/{r.maxRawScore??"—"} · рейтинг {r.ratingScore??"не вказано"}</p></Card>)}</section>
  </div>;
}
