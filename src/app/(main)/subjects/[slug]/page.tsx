import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowRight,BookOpen,Search} from "lucide-react";
import {STATUS_LABEL} from "@/lib/constants";
import {lessonAccess} from "@/lib/readiness";
import {prisma} from "@/lib/prisma";
import {averageForSubject,changeFromInitial,formatDelta} from "@/lib/scoring";
import {Badge,Button,Card,Input} from "@/components/ui";
import {FlowBreadcrumbs,FlowOpen,FlowProgress,FlowReturn,FlowTitle,MaterialChips,subjectLearningSummary} from "@/components/subject-flow";
import {requireUser} from "@/server/session";

export default async function SubjectPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams?:Promise<{q?:string;status?:string;page?:string}>}) {
 const user=await requireUser();
 const {slug}=await params;
 const filters:{q?:string;status?:string;page?:string}=await(searchParams??Promise.resolve({}));
 const subject=await prisma.subject.findUnique({where:{id:slug},include:{topics:{orderBy:{sortOrder:"asc"},include:{questions:{where:{verificationStatus:"VERIFIED"},select:{id:true}},videos:{select:{reviewStatus:true}}}},examResults:{where:{userId:user.id},orderBy:{date:"desc"}}}});
 if(!subject)notFound();
 const progress=await prisma.userTopicProgress.findMany({where:{userId:user.id,topicId:{in:subject.topics.map(topic=>topic.id)}}});
 const statuses=new Map(progress.map(item=>[item.topicId,item.status]));
 const query=(filters.q??"").trim().slice(0,120);
 const status=filters.status&&STATUS_LABEL[filters.status]?filters.status:"";
 const matches=subject.topics.filter(topic=>(!query||topic.title.toLocaleLowerCase("uk-UA").includes(query.toLocaleLowerCase("uk-UA")))&&(!status||(statuses.get(topic.id)??"NOT_STARTED")===status));
 const pages=Math.max(1,Math.ceil(matches.length/12));
 const requested=Number(filters.page??1);
 const page=Number.isSafeInteger(requested)?Math.max(1,Math.min(requested,pages)):1;
 const rows=matches.slice((page-1)*12,page*12);
 const pageUrl=(next:number)=>`/subjects/${slug}?${new URLSearchParams({page:String(next),...(query?{q:query}:{}),...(status?{status}:{})})}`;
 const points=subject.examResults.map(result=>({subjectId:result.subjectId,date:result.date.toISOString().slice(0,10),ratingScore:result.ratingScore,partial:result.partial,belowThreshold:result.belowThreshold,countsTowardAverage:result.countsTowardAverage}));
 const average=averageForSubject(points,subject.id),delta=changeFromInitial(points,subject.id);
 const learning=subjectLearningSummary(subject.topics,statuses);
 const current=learning.available.find(topic=>statuses.get(topic.id)==="IN_PROGRESS");
 const first=current??learning.available.find(topic=>statuses.get(topic.id)!=="MASTERED")??learning.available[0];

 return <div className="d031-flow" data-subject={subject.id}>
  <FlowBreadcrumbs subject={subject}/>
  <section className="d031-subject-hero" aria-label="Огляд предмета">
   <div><FlowTitle subject={subject} title={subject.name} description={subject.description}/><div className="d031-hero-actions">{first?<FlowOpen href={`/topics/${first.id}`} label={current?"Продовжити навчання":statuses.get(first.id)==="MASTERED"?"Повторити тему":"Відкрити доступну тему"}/>:null}<FlowReturn href="/subjects" label="До всіх предметів"/></div></div>
   <FlowProgress subjectName={subject.name} summary={learning}/>
  </section>
  <dl className="d031-metrics" aria-label="Рейтингові результати"><div><dt>Середній рейтинговий бал</dt><dd>{average.value??average.label}</dd></div><div><dt>Зміна від першого результату</dt><dd>{formatDelta(delta.value)}</dd></div><div><dt>Записів результатів</dt><dd>{subject.examResults.length}</dd></div></dl>
  <section aria-labelledby="d031-program-title"><div className="d031-section-heading d031-program-heading"><h2 id="d031-program-title">Програма предмета</h2><span>{subject.topics.length} тем і розділів</span></div>
   <Card className="d031-filter-panel"><form key={JSON.stringify([query,status])} className="d031-filter-form"><label><span>Пошук теми</span><div className="d031-search-input"><Search aria-hidden="true"/><Input name="q" defaultValue={query} placeholder="Назва теми"/></div></label><label><span>Мій прогрес</span><select name="status" defaultValue={status}><option value="">Усі теми</option>{Object.entries(STATUS_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><div className="d031-filter-actions"><Button type="submit">Знайти</Button><Button asChild variant="ghost"><Link href={`/subjects/${slug}`}>Скинути</Link></Button></div></form></Card>
   {rows.length?<div className="d031-topic-grid">{rows.map(topic=>{
    const children=subject.topics.filter(child=>child.parentId===topic.id);
    const availability=lessonAccess(topic);
    const parent=subject.topics.find(item=>item.id===topic.parentId);
    return <Card key={topic.id} data-testid="topic-card" className="d031-topic-card"><div className="d031-topic-kicker"><span>{children.length?"Розділ":parent?.title??"Тема"}</span><Badge>{STATUS_LABEL[statuses.get(topic.id)??"NOT_STARTED"]}</Badge></div><h3>{topic.title}</h3>{children.length?<p className="d031-muted">Тем у розділі: {children.length}. Перегляньте доступні уроки.</p>:<MaterialChips topic={topic}/>}<Link className="d031-card-open" href={`/topics/${topic.id}`}>{children.length?"Переглянути розділ":availability.available?"Відкрити тему":"Про тему"}<ArrowRight aria-hidden="true"/></Link></Card>;
   })}</div>:<Card className="d031-empty"><span className="d031-empty-icon"><BookOpen aria-hidden="true"/></span><h3>{query||status?"Нічого не знайдено":"Програму предмета готують"}</h3><p>{query||status?"Спробуйте іншу назву або скиньте фільтри.":"Теми та матеріали ще не додані. Ви можете повернутися до своїх предметів і продовжити підготовку з доступних тем."}</p><FlowReturn href={query||status?`/subjects/${slug}`:"/subjects"} label={query||status?"Скинути фільтри":"До предметів"}/></Card>}
   <nav aria-label="Сторінки тем" className="d031-pagination"><span>{matches.length} тем · сторінка {page} із {pages}</span><div>{page>1?<Button asChild variant="outline" size="sm"><Link href={pageUrl(page-1)}>Назад</Link></Button>:null}{page<pages?<Button asChild variant="outline" size="sm"><Link href={pageUrl(page+1)}>Далі</Link></Button>:null}</div></nav>
  </section>
 </div>;
}
