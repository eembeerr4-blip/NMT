import Link from "next/link";
import {Button,Card,PageHeader} from "@/components/ui";
import {SubjectIcon} from "@/components/subject-icon";
import {prisma} from "@/lib/prisma";
import {requireUser} from "@/server/session";
export const dynamic="force-dynamic";
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){
 await requireUser();const params=await searchParams;const q=(params.q??"").trim().slice(0,120);
 const normalized=q.normalize("NFKC").toLocaleLowerCase("uk-UA");
 const [subjectCatalog,topicCatalog]=q?await Promise.all([prisma.subject.findMany({take:100,orderBy:{sortOrder:"asc"}}),prisma.topic.findMany({select:{id:true,title:true,summary:true,subject:{select:{name:true}}},take:5000,orderBy:{sortOrder:"asc"}})]):[[],[]];
 const subjects=subjectCatalog.filter(subject=>subject.name.normalize("NFKC").toLocaleLowerCase("uk-UA").includes(normalized)).slice(0,12);
 const topics=topicCatalog.filter(topic=>(topic.title+" "+topic.summary).normalize("NFKC").toLocaleLowerCase("uk-UA").includes(normalized)).slice(0,30);
 return <div className="space-y-6"><PageHeader title="Пошук матеріалів" description="Знайдіть предмет або тему, щоб перейти до навчання."/><Card className="p-5"><form key={q} role="search" className="flex flex-wrap items-end gap-3"><label className="grid min-w-0 flex-1 gap-1.5 text-sm"><span className="font-medium">Назва предмета або теми</span><input name="q" defaultValue={q} maxLength={120} placeholder="Наприклад, рівняння"/></label><Button type="submit">Знайти</Button></form></Card>{q?<><p className="text-sm text-muted-foreground">Знайдено {subjects.length+topics.length} матеріалів за запитом «{q}»</p><div className="grid gap-3 lg:grid-cols-2">{subjects.map(subject=><Link href={`/subjects/${subject.id}`} key={subject.id}><Card className="flex h-full items-center gap-3 p-5 hover:border-primary/50"><SubjectIcon id={subject.id}/><div><h2 className="font-semibold">{subject.name}</h2><p className="text-sm text-muted-foreground">Предмет →</p></div></Card></Link>)}{topics.map(topic=><Link href={`/learn/${topic.id}`} key={topic.id}><Card className="h-full space-y-2 p-5 hover:border-primary/50"><p className="text-xs text-muted-foreground">{topic.subject.name}</p><h2 className="font-semibold">{topic.title}</h2><p className="text-sm font-medium text-primary">Відкрити урок →</p></Card></Link>)}</div>{!subjects.length&&!topics.length?<Card className="space-y-2 p-6"><h2 className="font-semibold">Матеріалів не знайдено</h2><p className="text-sm text-muted-foreground">Спробуйте коротшу назву або оберіть предмет у бібліотеці.</p><Link href="/subjects" className="inline-flex text-sm text-primary">Перейти до предметів →</Link></Card>:null}</>:null}</div>;
}
