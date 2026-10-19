import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {SubjectIcon} from "@/components/subject-icon";
import {lessonAccess} from "@/lib/readiness";
import {prisma} from "@/lib/prisma";
import {Button,Card,PageHeader,Progress} from "@/components/ui";
import {requireUser} from "@/server/session";

export default async function SubjectsPage() {
 const user=await requireUser();
 const active=new Set(user.subjects.filter(item=>item.active).map(item=>item.subjectId));
 const [subjects,progress]=await Promise.all([
  prisma.subject.findMany({orderBy:{sortOrder:"asc"},include:{topics:{include:{questions:{where:{verificationStatus:"VERIFIED"},select:{id:true}},videos:{select:{reviewStatus:true}}}}}}),
  prisma.userTopicProgress.findMany({where:{userId:user.id}}),
 ]);
 const statuses=new Map(progress.map(item=>[item.topicId,item.status]));
 const mine=subjects.filter(subject=>active.has(subject.id));
 const library=subjects.filter(subject=>!active.has(subject.id));
 function cards(items:typeof subjects) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(subject=>{
   const leaves=subject.topics.filter(topic=>!subject.topics.some(child=>child.parentId===topic.id));
   const mastered=leaves.filter(topic=>statuses.get(topic.id)==="MASTERED").length;
   const available=leaves.filter(topic=>lessonAccess(topic).available).length;
   const percent=leaves.length?Math.round(mastered/leaves.length*100):0;
   return <Link key={subject.id} href={`/subjects/${subject.id}`}><Card className="flex h-full flex-col gap-4 p-5 transition hover:border-primary/50"><SubjectIcon id={subject.id}/><div className="min-w-0"><h3 className="text-lg font-semibold">{subject.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{subject.description}</p></div><p className="text-sm font-medium text-muted-foreground">{available?`Доступно тем: ${available}`:"Матеріал готується"}</p>{leaves.length?<div className="mt-auto space-y-2"><div className="flex justify-between gap-2 text-sm"><span>Засвоєно {mastered} із {leaves.length}</span><span>{percent}%</span></div><Progress value={percent}/></div>:<p className="mt-auto text-sm text-muted-foreground">Прогрес з’явиться після додавання тем.</p>}<span className="flex items-center justify-between border-t border-border pt-3 text-sm font-medium text-primary">Переглянути теми<ArrowRight className="h-4 w-4"/></span></Card></Link>;
  })}</div>;
 }
 return <div className="space-y-6"><PageHeader title="Предмети" description="Ваші чотири предмети та бібліотека інших напрямів." action={<Button asChild variant="outline"><Link href="/curriculum">Відкрити мій план</Link></Button>}/><section aria-label="Мої предмети" className="space-y-4"><h2 className="text-lg font-semibold">Мої предмети</h2>{cards(mine)}</section>{library.length?<details className="space-y-4 rounded-2xl border border-border bg-card p-5"><summary className="cursor-pointer font-semibold">Бібліотека інших предметів · {library.length}</summary><p className="text-sm leading-6 text-muted-foreground">Ці предмети не входять у ваш поточний план. Предмет на вибір можна змінити в налаштуваннях.</p>{cards(library)}</details>:null}</div>;
}
