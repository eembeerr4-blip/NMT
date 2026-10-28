import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/session';
import { prisma } from '@/lib/prisma';
import { ownedRetryQuestion, publicRetryQuestion, retryTypes } from '@/server/mistake-retry';
import { MistakeRetryForm } from '@/components/mistake-retry-form';
import { Card, PageHeader } from '@/components/ui';
export default async function MistakeRetryPage({params}:{params:Promise<{mistakeId:string}>}) {
  const user=await requireUser(),{mistakeId}=await params;
  const mistake=await ownedRetryQuestion(prisma,user.id,mistakeId).catch(()=>null);
  if(!mistake)notFound();
  const {question,revision}=publicRetryQuestion(mistake.question!);
  const history=await prisma.mistakeRetry.findMany({where:{mistakeId:mistake.id,mistake:{userId:user.id}},select:{id:true,isCorrect:true,createdAt:true},orderBy:{createdAt:'desc'},take:20});
  return <div className="space-y-5"><PageHeader title="Повторне розв’язання" description="Введіть нову відповідь. Пояснення з’явиться лише після відправлення."/>
    <div className="flex flex-wrap gap-4 text-sm underline"><Link href="/mistakes">До помилок</Link><Link href="/review">До повторень</Link><Link href={'/learn/'+mistake.topicId}>Конспект теми</Link></div>
    {retryTypes.includes(question.type)?<MistakeRetryForm mistakeId={mistake.id} requestId={randomUUID()} revision={revision} question={question}/>:<Card className="p-5">Автоматична перевірка цього типу завдання недоступна. Скористайтеся конспектом і ручним статусом помилки.</Card>}
    <Card className="space-y-2 p-4"><h2 className="font-medium">Історія повторних розв’язань</h2>{history.length?history.map(row=><p key={row.id} className="text-sm">{row.createdAt.toLocaleString('uk-UA')} · {row.isCorrect===true?'Правильно':row.isCorrect===false?'Неправильно':'Не підтверджено автоматично'}</p>):<p className="text-sm text-muted-foreground">Спроб ще немає. Відкриття сторінки не змінює статус помилки.</p>}</Card></div>;
}
