import Link from "next/link";
import {notFound} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {testPublication} from "@/lib/test-publication";
import {requireAdministrator} from "@/server/session";
import {Card,PageHeader} from "@/components/ui";
import {MathText} from "@/components/math-text";
import {TestSetControls,TestSetForm} from "@/components/test-set-controls";
export default async function TestSetPage({params}:{params:Promise<{id:string}>}) {
 await requireAdministrator();const {id}=await params;
 const set=await prisma.test.findUnique({where:{id},include:{questions:{orderBy:{sortOrder:"asc"},include:{question:{include:{options:{orderBy:{sortOrder:"asc"}}}}}},_count:{select:{attempts:true}}}});if(!set)notFound();
 const subjects=await prisma.subject.findMany({select:{id:true,name:true},orderBy:{sortOrder:"asc"}});
 const choices=set._count.attempts?[]:await prisma.question.findMany({where:{verificationStatus:"VERIFIED",OR:[{subjectId:set.subjectId??""},{id:{in:set.questions.map(q=>q.questionId)}}]},select:{id:true,subjectId:true,prompt:true},orderBy:{id:"asc"}});
 return <><PageHeader title={set.title} description={`${set.questions.length} запитань · ${set.timeLimitSec?`${set.timeLimitSec/60} хв` :"Без таймера"} · ${set._count.attempts} спроб`}/><Link href="/admin/tests" className="text-sm text-primary">← Усі набори</Link><Card className="p-5"><TestSetControls id={id} state={testPublication(set.configJson)}/></Card><Card className="space-y-4 p-5"><h2 className="font-semibold">Перегляд набору</h2><p className="text-sm text-muted-foreground">Перегляд не створює учнівської спроби й не змінює прогрес.</p>{set.questions.map((item,index)=><section key={item.id} className="space-y-2 border-t border-border pt-3"><h3 className="text-sm font-medium">Завдання {index+1}</h3><MathText text={item.question.prompt}/><ul className="space-y-1 text-sm">{item.question.options.map(option=><li key={option.id}>{option.label}. {option.text}</li>)}</ul></section>)}</Card><Card className="p-5">{set._count.attempts?<p className="text-sm">Набір уже має спроби й захищений від редагування. Створіть нову версію; історія залишиться в оригіналі.</p>:<><h2 className="mb-4 font-semibold">Редагувати чернетку</h2><TestSetForm subjects={subjects} questions={choices} initial={{id:set.id,title:set.title,subjectId:set.subjectId,timeLimitSec:set.timeLimitSec,questionIds:set.questions.map(q=>q.questionId)}}/></>}</Card></>;
}
