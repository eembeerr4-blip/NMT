import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowRight,BookOpen,Clock3} from "lucide-react";
import {STATUS_LABEL} from "@/lib/constants";
import {lessonAccess} from "@/lib/readiness";
import {formatUk} from "@/lib/dates";
import {prisma} from "@/lib/prisma";
import {requireUser} from "@/server/session";
import {MathText} from "@/components/math-text";
import {StudyLogForm} from "@/components/forms";
import {Badge,Card} from "@/components/ui";
import {FlowBreadcrumbs,FlowOpen,FlowReturn,FlowTime,FlowTitle,MaterialChips} from "@/components/subject-flow";

export default async function TopicPage({params}:{params:Promise<{id:string}>}) {
 const user=await requireUser();
 const {id}=await params;
 const topic=await prisma.topic.findUnique({where:{id},include:{
  subject:true,children:{select:{id:true,title:true}},
  videos:{orderBy:{createdAt:"asc"},include:{progress:{where:{userId:user.id}}}},
  questions:{where:{verificationStatus:"VERIFIED"}},
  dependsOn:{include:{prerequisite:true}},
  tests:{include:{attempts:{where:{status:"COMPLETED",userId:user.id},orderBy:{finishedAt:"desc"},take:5}}},
 }});
 if(!topic)notFound();
 const progress=await prisma.userTopicProgress.findUnique({where:{userId_topicId:{userId:user.id,topicId:topic.id}}});
 const learningStatus=progress?.status??"NOT_STARTED";
 const availability=lessonAccess(topic);
 const attempts=topic.tests.flatMap(test=>test.attempts).sort((a,b)=>(b.finishedAt?.getTime()??0)-(a.finishedAt?.getTime()??0));
 const advice=!progress?.lastTotal?"Після тесту тут буде рекомендація.":learningStatus==="MASTERED"?"Тему попередньо засвоєно.":learningStatus==="NEEDS_REVIEW"?"Потрібне закріплення.":"Варто повторити теорію перед новою спробою.";
 const hasMaterial=availability.available||topic.children.length>0;

 return <div className="d031-flow" data-subject={topic.subjectId}>
  <FlowBreadcrumbs subject={topic.subject} topic={topic.title}/>
  <header className="d031-topic-hero"><FlowTitle subject={topic.subject} title={topic.title}><div className="d031-topic-meta"><Badge>{STATUS_LABEL[learningStatus]}</Badge><FlowTime minutes={topic.estimatedMin}/></div></FlowTitle><div className="d031-hero-actions">{hasMaterial?<FlowOpen href={`/learn/${topic.id}`} label={topic.children.length?"Переглянути розділ":"Відкрити урок"}/>:null}<FlowReturn href={`/subjects/${topic.subjectId}`} label="До тем предмета"/></div></header>
  {!hasMaterial?<Card className="d031-empty"><span className="d031-empty-icon"><BookOpen aria-hidden="true"/></span><h2>Матеріал готується</h2><p>Теорія, відео та практика ще не додані. Перегляньте інші теми цього предмета.</p><FlowReturn href={`/subjects/${topic.subjectId}`} label="Обрати іншу тему"/></Card>:<Card className="d031-overview"><div className="d031-section-heading"><h2>Про тему</h2>{topic.children.length?<span>Розділ</span>:<MaterialChips topic={topic}/>}</div>{topic.summary.trim()?<MathText text={topic.summary}/>:<p className="d031-muted">Короткий опис ще готується. Доступні матеріали можна відкрити в уроці.</p>}{topic.formulas?<section><h3>Основні формули</h3><MathText text={topic.formulas}/></section>:null}{topic.dependsOn.length?<section><h3>Перед початком</h3><p className="d031-muted">Ця тема спирається на:</p><div className="d031-prerequisites">{topic.dependsOn.map(item=><Link key={item.prerequisite.id} href={`/topics/${item.prerequisite.id}`}>{item.prerequisite.title}<ArrowRight aria-hidden="true"/></Link>)}</div></section>:null}<p className="d031-advice">{advice}</p></Card>}
  {topic.children.length?<section className="d031-children" aria-label="Теми розділу"><div className="d031-section-heading"><h2>Теми розділу</h2><span>{topic.children.length}</span></div>{topic.children.map(child=><Link key={child.id} href={`/topics/${child.id}`}><BookOpen aria-hidden="true"/><span>{child.title}</span><ArrowRight aria-hidden="true"/></Link>)}</section>:null}
  <div className="d031-details-grid"><Card className="d031-results"><div className="d031-section-heading"><h2><BookOpen aria-hidden="true"/>Попередні результати</h2></div>{attempts.length?<div className="d031-result-list">{attempts.map(attempt=><Link key={attempt.id} href={`/tests/${attempt.id}`}><span>{attempt.finishedAt?formatUk(attempt.finishedAt):"Без дати"}<small>{attempt.pendingCount?`На перевірці: ${attempt.pendingCount}`:"Завершена практика"}</small></span><strong>{attempt.correctCount??0}<span>/{attempt.totalCount??0}</span></strong><ArrowRight aria-hidden="true"/></Link>)}</div>:<div className="d031-inline-empty"><p>Тестів за темою ще не завершено.</p><p>Тут з’являться ваші результати та посилання на розбір відповідей.</p></div>}</Card></div>
  {hasMaterial?<Card className="d031-study-time"><div><h2><Clock3 aria-hidden="true"/>Час навчання</h2><p className="d031-muted">Запишіть час самостійного опрацювання цієї теми.</p></div><StudyLogForm subjectId={topic.subjectId} topicId={topic.id}/></Card>:null}
  <FlowReturn href={`/subjects/${topic.subjectId}`} label="Назад до предмета"/>
 </div>;
}
