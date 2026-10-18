import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicEditor } from "@/components/forms";
import { Card, PageHeader, Button } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { isAdministrator } from "@/lib/permissions";
import { requireContentEditor } from "@/server/session";
export const dynamic="force-dynamic";
export default async function EditTopicPage({params}:{params:Promise<{id:string}>}){
 const user=await requireContentEditor();const {id}=await params;
 const topic=await prisma.topic.findUnique({where:{id},include:{subject:true}});if(!topic)notFound();
 const progress=await prisma.userTopicProgress.findUnique({where:{userId_topicId:{userId:user.id,topicId:id}}});
 const base=isAdministrator(user)?"/admin":"/editor";
 return <><PageHeader title={topic.title} description={`${topic.subject.name} · редагування спільної теми`} action={<Button asChild variant="outline"><Link href={`${base}/topics`}>До списку тем</Link></Button>}/><Card className="max-w-4xl p-5 sm:p-6"><TopicEditor topic={{id,subjectId:topic.subjectId,title:topic.title,summary:topic.summary,formulas:topic.formulas,status:progress?.status??"NOT_STARTED"}}/></Card><Button asChild variant="outline"><Link href={`${base}/lessons/${id}`}>Редагувати матеріал і відео уроку</Link></Button></>;
}
