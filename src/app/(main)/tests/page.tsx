import Link from "next/link";
import {Card,EmptyState,PageHeader,Button,Badge} from "@/components/ui";
import {StartTestSet} from "@/components/test-set-controls";
import {prisma} from "@/lib/prisma";
import {testPublication} from "@/lib/test-publication";
import {requireUser} from "@/server/session";
export default async function TestsPage(){
 const user=await requireUser();const active=user.subjects.filter(subject=>subject.active).map(subject=>subject.subjectId);
 const [attempts,published]=await Promise.all([
  prisma.testAttempt.findMany({where:{userId:user.id},orderBy:{startedAt:"desc"},take:30,include:{test:{include:{topic:true,subject:true}}}}),
  prisma.test.findMany({where:{subjectId:{in:active},configJson:{contains:'"publication":"PUBLISHED"'}},include:{subject:true,_count:{select:{questions:true}}},orderBy:{createdAt:"desc"},take:100})
 ]);
 return <div className="space-y-6"><PageHeader title="Мої тести" description="Продовжуйте розпочаті тести та переглядайте свої результати." action={<Button asChild><Link href="/subjects">Обрати тему для тесту</Link></Button>}/>
 {published.length?<section className="space-y-3"><h2 className="text-lg font-semibold">Опубліковані набори</h2><div className="grid gap-3 lg:grid-cols-2">{published.filter(set=>testPublication(set.configJson)==="PUBLISHED").map(set=><Card key={set.id} className="space-y-3 p-5"><Badge>{set.subject?.name}</Badge><h3 className="font-semibold">{set.title}</h3><p className="text-sm text-muted-foreground">{set._count.questions} запитань · Тренувальний тест · {set.timeLimitSec?`${set.timeLimitSec/60} хв` :"Без таймера"}</p><StartTestSet id={set.id}/></Card>)}</div></section>:null}
 <h2 className="text-lg font-semibold">Історія та незавершені спроби</h2>{attempts.length?<div className="grid gap-3 lg:grid-cols-2">{attempts.map(attempt=><Link key={attempt.id} href={`/tests/${attempt.id}`}><Card className="h-full space-y-3 p-5 transition hover:border-primary/50"><div className="flex flex-wrap items-center justify-between gap-2"><Badge>{attempt.test.subject?.name??"Кілька предметів"}</Badge><Badge>{attempt.status==="COMPLETED"?"Завершено":"Можна продовжити"}</Badge></div><h3 className="font-semibold">{attempt.test.title}</h3><p className="text-sm text-muted-foreground">{attempt.status==="COMPLETED"?`${attempt.correctCount??0} правильних відповідей із ${attempt.totalCount??0}`:"Відкрийте тест, щоб продовжити зі збережених відповідей."}</p><span className="inline-flex text-sm font-semibold text-primary">{attempt.status==="COMPLETED"?"Переглянути результат":"Продовжити тест"} →</span></Card></Link>)}</div>:<EmptyState title="Тестів ще немає" text="Оберіть предмет, відкрийте урок і перейдіть до вкладки «Практика». Тут збережеться історія ваших спроб."/>}</div>;
}
