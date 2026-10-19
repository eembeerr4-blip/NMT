import Link from "next/link";
import type {ReactNode} from "react";
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,Clock3,FileText,PlayCircle} from "lucide-react";
import {SubjectIcon} from "@/components/subject-icon";
import {Card} from "@/components/ui";
import {lessonAccess} from "@/lib/readiness";

type LearningTopic={id:string;parentId:string|null;lessonJson:string;questions:unknown[];videos:{reviewStatus:string}[]};
/** Same leaf/mastery/availability calculation already accepted in D03's catalogue. */
export function subjectLearningSummary<T extends LearningTopic>(topics:T[],statuses:Map<string,string>){
 const leaves=topics.filter(topic=>!topics.some(child=>child.parentId===topic.id));
 const mastered=leaves.filter(topic=>statuses.get(topic.id)==="MASTERED").length;
 const available=leaves.filter(topic=>lessonAccess(topic).available);
 return {leaves,mastered,available,percent:leaves.length?Math.round(mastered/leaves.length*100):0,showProgress:leaves.length>0&&(available.length>0||mastered>0)};
}

export function FlowBreadcrumbs({subject,topic}:{subject?:{id:string;name:string};topic?:string}){
 return <nav aria-label="Навчальний шлях" className="d031-breadcrumbs"><Link href="/subjects">Предмети</Link>{subject?<><span aria-hidden="true">/</span>{topic?<Link href={`/subjects/${subject.id}`}>{subject.name}</Link>:<span aria-current="page">{subject.name}</span>}</>:null}{topic?<><span aria-hidden="true">/</span><span aria-current="page">{topic}</span></>:null}</nav>;
}

export function FlowTitle({subject,title,description,children}:{subject:{id:string;name:string};title:string;description?:string;children?:ReactNode}){
 return <div className="d031-title"><SubjectIcon id={subject.id} variant="catalog"/><div><p className="d031-eyebrow">{subject.name===title?"Підготовка до НМТ":subject.name}</p><h1>{title}</h1>{description?<p className="d031-description">{description}</p>:null}{children}</div></div>;
}

export function FlowProgress({subjectName,summary}:{subjectName:string;summary:{leaves:unknown[];mastered:number;available:unknown[];percent:number;showProgress:boolean}}){
 return <Card className="d031-progress"><div className="d031-section-heading"><h2>Мій прогрес</h2><CheckCircle2 aria-hidden="true"/></div>{summary.showProgress?<><div className="d031-progress-value"><strong>{summary.percent}<small>%</small></strong><span>Засвоєно {summary.mastered} із {summary.leaves.length} тем</span></div><div className="d031-progress-track" role="progressbar" aria-label={`Засвоєні теми: ${subjectName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.percent}><span style={{width:`${summary.percent}%`}}/></div></>:<p className="d031-progress-empty">{summary.leaves.length?"Прогрес з’явиться після роботи з доступними матеріалами.":"Прогрес з’явиться, коли будуть додані теми."}</p>}<p className="d031-progress-caption">{summary.available.length?`Доступно для навчання: ${summary.available.length} із ${summary.leaves.length} тем.`:"Матеріали готуються."}</p></Card>;
}

export function MaterialChips({topic}:{topic:{lessonJson:string;questions?:unknown[];videos?:{reviewStatus:string}[]}}){
 const access=lessonAccess(topic);
 return <div className="d031-material-chips" aria-label="Доступні матеріали">{access.theory?<span><FileText aria-hidden="true"/>Теорія</span>:null}{access.video?<span><PlayCircle aria-hidden="true"/>Відео</span>:null}{access.practice?<span><BookOpen aria-hidden="true"/>Практика</span>:null}{!access.available?<span>Матеріал готується</span>:null}</div>;
}

export function FlowReturn({href,label}:{href:string;label:string}){return <Link href={href} className="d031-text-link"><ArrowLeft aria-hidden="true"/>{label}</Link>}
export function FlowOpen({href,label}:{href:string;label:string}){return <Link href={href} className="d031-primary-link">{label}<ArrowRight aria-hidden="true"/></Link>}
export function FlowTime({minutes}:{minutes:number}){return minutes>0?<span className="d031-time"><Clock3 aria-hidden="true"/>Орієнтовно {minutes} хв</span>:null}
