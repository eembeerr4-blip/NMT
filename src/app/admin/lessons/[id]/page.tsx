import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonEditor, PublishLessonButton } from "@/components/lesson-editor";
import { VideoPanel } from "@/components/video-panel";
import { Button, Card, PageHeader } from "@/components/ui";
import { parseLesson } from "@/lib/lesson";
import { prisma } from "@/lib/prisma";
import { isAdministrator } from "@/lib/permissions";
import { requireContentEditor } from "@/server/session";
export const dynamic="force-dynamic";
export default async function EditLessonPage({params}:{params:Promise<{id:string}>}){
 const user=await requireContentEditor();const {id}=await params;
 const topic=await prisma.topic.findUnique({where:{id},include:{subject:true,videos:{orderBy:{createdAt:"asc"}}}});if(!topic)notFound();
 const base=isAdministrator(user)?"/admin":"/editor";
 return <><PageHeader title={topic.title} description={`${topic.subject.name} · матеріал уроку та спільні відео`} action={<Button asChild variant="outline"><Link href={`${base}/lessons`}>До списку уроків</Link></Button>}/><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/learn/${id}`}>Попередній перегляд</Link></Button><Button asChild variant="outline"><Link href={`${base}/topics/${id}`}>Опис теми та формули</Link></Button></div>{topic.coverage==="DRAFT"?<p className="text-sm">Чернетка. Учні не бачать цей урок, доки ви не перевірите й не опублікуєте його.</p>:null}<PublishLessonButton topicId={id} coverage={topic.coverage}/><Card className="p-5"><h2 className="mb-3 text-lg font-semibold">Матеріал уроку</h2><LessonEditor topicId={id} lesson={parseLesson(topic.lessonJson)}/></Card><section className="space-y-3"><h2 className="text-lg font-semibold">Відеоматеріали</h2><VideoPanel topicId={id} topicTitle={`${topic.subject.name} ${topic.title}`} canEdit videos={topic.videos.map(video=>({...video,notes:"",lastPositionSec:0}))}/></section></>;
}
