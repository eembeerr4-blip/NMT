import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {SubjectIcon} from "@/components/subject-icon";
import {lessonAccess} from "@/lib/readiness";
import {prisma} from "@/lib/prisma";
import {Button,Card,PageHeader} from "@/components/ui";
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
 function cards(items:typeof subjects,compact=false) {
  return <div className={compact?"d03-library-grid":"d03-active-grid"}>{items.map(subject=>{
   const leaves=subject.topics.filter(topic=>!subject.topics.some(child=>child.parentId===topic.id));
   const mastered=leaves.filter(topic=>statuses.get(topic.id)==="MASTERED").length;
   const available=leaves.filter(topic=>lessonAccess(topic).available).length;
   const percent=leaves.length?Math.round(mastered/leaves.length*100):0;
   const showProgress=leaves.length>0&&(available>0||mastered>0);
   return <Link key={subject.id} href={`/subjects/${subject.id}`} className="d03-subject-link" data-subject={subject.id} aria-label={`Відкрити предмет «${subject.name}»`}><Card className={`d03-subject-card ${compact?"d03-subject-compact":""}`}>
    <div className="d03-card-heading"><SubjectIcon id={subject.id} variant="catalog"/><div><h3>{subject.name}</h3>{!compact&&subject.description?<p className="d03-description">{subject.description}</p>:null}</div></div>
    <p className="d03-material-status">{available?`Доступно тем: ${available} із ${leaves.length}`:"Матеріали готуються"}</p>
    {showProgress?<div className="d03-progress"><div className="d03-progress-copy"><span>Засвоєно {mastered} із {leaves.length}</span><strong>{percent}%</strong></div><div className="d03-progress-track" role="progressbar" aria-label={`Засвоєні теми: ${subject.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:`${percent}%`}}/></div></div>:<p className="d03-progress-empty">{leaves.length?"Навчальний прогрес поки не показуємо.":"Теми ще не додано."}</p>}
    <span className="d03-open">{compact?"Відкрити":"Переглянути теми"}<ArrowRight aria-hidden="true"/></span>
   </Card></Link>;
  })}</div>;
 }
 return <div className="d03-catalog"><PageHeader title="Предмети" description="Обрані предмети для підготовки до НМТ та повна бібліотека напрямів." action={<Button asChild variant="outline"><Link href="/curriculum">Мій навчальний план<ArrowRight aria-hidden="true" className="h-4 w-4"/></Link></Button>}/>
  <section aria-labelledby="d03-active-title"><div className="d03-section-heading"><h2 id="d03-active-title">Мої предмети <span>{mine.length}</span></h2>{library.length?<a href="#d03-library">Усі предмети ↓</a>:null}</div>
   {mine.length?cards(mine):<Card className="d03-empty"><h3>Обраних предметів поки немає</h3><p>Можна переглянути бібліотеку. Перевір свій вибір у налаштуваннях, розділ «Навчання».</p><Link href="/settings">Відкрити налаштування →</Link></Card>}
  </section>
  {library.length?<section id="d03-library" aria-labelledby="d03-library-title"><div className="d03-section-heading"><h2 id="d03-library-title">Інші предмети <span>{library.length}</span></h2></div><p className="d03-library-copy">Перегляд не змінює твій четвертий предмет. Змінити вибір можна в <Link href="/settings">налаштуваннях навчання</Link>.</p>{cards(library,true)}</section>:null}
  {!subjects.length?<p className="d03-library-copy">Бібліотека ще готується. Предмети з’являться після додавання матеріалів.</p>:null}
 </div>;
}
