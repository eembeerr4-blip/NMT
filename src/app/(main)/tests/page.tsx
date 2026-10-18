import Link from "next/link";
import { Card, EmptyState, PageHeader, Button, Badge } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/session";
export default async function TestsPage(){
 const user=await requireUser();
 const attempts=await prisma.testAttempt.findMany({where:{userId:user.id},orderBy:{startedAt:"desc"},take:30,include:{test:{include:{topic:true,subject:true}}}});
 return <div className="space-y-6"><PageHeader title="Мої тести" description="Продовжуйте розпочаті тести та переглядайте свої результати." action={<Button asChild><Link href="/subjects">Обрати тему для тесту</Link></Button>}/>{attempts.length?<div className="grid gap-3 lg:grid-cols-2">{attempts.map(attempt=><Link key={attempt.id} href={`/tests/${attempt.id}`}><Card className="h-full space-y-3 p-5 transition hover:border-primary/50"><div className="flex flex-wrap items-center justify-between gap-2"><Badge>{attempt.test.subject?.name??"Кілька предметів"}</Badge><Badge>{attempt.status==="COMPLETED"?"Завершено":"Можна продовжити"}</Badge></div><h2 className="font-semibold">{attempt.test.title}</h2><p className="text-sm text-muted-foreground">{attempt.status==="COMPLETED"?`${attempt.correctCount??0} правильних відповідей із ${attempt.totalCount??0}`:"Відкрийте тест, щоб продовжити зі збережених відповідей."}</p><span className="inline-flex text-sm font-semibold text-primary">{attempt.status==="COMPLETED"?"Переглянути результат":"Продовжити тест"} →</span></Card></Link>)}</div>:<EmptyState title="Тестів ще немає" text="Оберіть предмет, відкрийте урок і перейдіть до вкладки «Практика». Тут збережеться історія ваших спроб."/>}</div>;
}
