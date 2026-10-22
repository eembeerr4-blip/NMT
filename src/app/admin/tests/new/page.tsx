import Link from "next/link";
import {prisma} from "@/lib/prisma";
import {isAdministrator} from "@/lib/permissions";
import {requireContentEditor} from "@/server/session";
import {Card,PageHeader,Button} from "@/components/ui";
import {TestSetForm} from "@/components/test-set-controls";
export default async function NewTestSet({searchParams}:{searchParams:Promise<{subject?:string;q?:string;page?:string}>}) {
 const user=await requireContentEditor();const base=isAdministrator(user)?"/admin":"/editor";const params=await searchParams;const q=(params.q??"").trim().slice(0,120);const requested=Number(params.page);const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,100000):1;
 const where={verificationStatus:"VERIFIED",...(params.subject?{subjectId:params.subject}:{}),...(q?{prompt:{contains:q}}:{})};
 const [subjects,questions,total]=await Promise.all([prisma.subject.findMany({select:{id:true,name:true},orderBy:{sortOrder:"asc"}}),prisma.question.findMany({where,select:{id:true,subjectId:true,prompt:true},orderBy:{id:"asc"},skip:(page-1)*100,take:100}),prisma.question.count({where})]);
 const url=(next:number)=>`${base}/tests/new?${new URLSearchParams({page:String(next),...(params.subject?{subject:params.subject}:{}),...(q?{q}:{})})}`;
 return <><PageHeader title="Новий набір тесту" description="Зберіть чернетку з перевірених запитань; публікація виконується окремо."/><Card className="space-y-3 p-5"><form className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">Предмет для пошуку<select name="subject" defaultValue={params.subject??""}><option value="">Усі предмети</option>{subjects.map(subject=><option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="grid flex-1 gap-1 text-sm">Пошук запитань<input name="q" defaultValue={q}/></label><Button type="submit">Знайти</Button></form><p className="text-sm text-muted-foreground">Знайдено {total}. Показано {questions.length}. Зміна фільтра відкриває нову форму — спочатку збережіть вибраний набір.</p><nav className="flex gap-3">{page>1?<Link href={url(page-1)}>← Назад</Link>:null}{page*100<total?<Link href={url(page+1)}>Далі →</Link>:null}</nav></Card><Card className="p-5"><TestSetForm basePath={base} defaultSubjectId={params.subject} subjects={subjects} questions={questions}/></Card></>;
}
