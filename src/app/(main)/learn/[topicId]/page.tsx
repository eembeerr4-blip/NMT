import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, ClipboardCheck } from "lucide-react";
import { STATUS_LABEL } from "@/lib/constants";
import { lessonAccess } from "@/lib/readiness";
import { formatUk } from "@/lib/dates";
import { parseLesson } from "@/lib/lesson";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/session";
import { CompleteLesson } from "@/components/lesson-tutor";
import { MathText } from "@/components/math-text";
import { TopicActions } from "@/components/forms";
import { VideoPanel } from "@/components/video-panel";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { SubjectIcon } from "@/components/subject-icon";
import { LessonTabs } from "@/components/lesson-tabs";
import { LessonExamples, LessonNotes, LessonSynopsis, LessonTheory } from "@/components/lesson/lesson-content";

export default async function LessonPage({ params }: { params: Promise<{ topicId: string }> }) {
  const user = await requireUser();
  const { topicId } = await params;
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subject: true, children: true,
      questions: { where: { verificationStatus: "VERIFIED" }, select: { difficulty: true } },
      videos: { where: { reviewStatus: "CONFIRMED" }, orderBy: { createdAt: "asc" }, include: { progress: { where: { userId: user.id } } } },
      notes: { where: { userId: user.id }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!topic) notFound();
  const availability = lessonAccess(topic);
  if (!availability.available && !topic.children.length) return <div className="d04-lesson"><PageHeader title={topic.title} description={topic.subject.name}/><EmptyState title="Матеріал готується" text="Цей урок ще готується. Оберіть іншу тему, щоб продовжити навчання." action={<Button asChild variant="outline"><Link href={`/subjects/${topic.subjectId}`}>До тем предмета</Link></Button>}/></div>;

  const [progress, verifiedCount, attempt, review, siblings] = await Promise.all([
    prisma.userTopicProgress.findUnique({ where: { userId_topicId: { userId: user.id, topicId } } }),
    prisma.question.count({ where: { topicId, verificationStatus: "VERIFIED" } }),
    prisma.testAttempt.findFirst({ where: { userId: user.id, status: "COMPLETED", test: { topicId } }, orderBy: { finishedAt: "desc" } }),
    prisma.reviewSchedule.findFirst({ where: { userId: user.id, topicId, status: "PENDING" }, orderBy: { dueKey: "asc" } }),
    prisma.topic.findMany({
      where: { subjectId: topic.subjectId, parentId: topic.parentId }, orderBy: { sortOrder: "asc" },
      include: { children: { select: { id: true } }, questions: { where: { verificationStatus: "VERIFIED" }, select: { id: true } }, videos: { where: { reviewStatus: "CONFIRMED" }, select: { reviewStatus: true } } },
    }),
  ]);
  const lesson = parseLesson(topic.lessonJson);
  const status = progress?.status ?? "NOT_STARTED";
  const availableSiblings = siblings.filter(item => lessonAccess(item).available || item.children.length > 0);
  const previous = availableSiblings.filter(item => item.sortOrder < topic.sortOrder).at(-1);
  const next = availableSiblings.find(item => item.sortOrder > topic.sortOrder);
  const practiceNote = verifiedCount >= 12
    ? "Закріпіть матеріал у тематичному тесті: до 12 перевірених запитань."
    : verifiedCount > 0
      ? `Для практики доступно ${verifiedCount} перевірених запитань.`
      : "Перевірених завдань для цієї теми ще немає. Оцінюваний тест не запускається.";

  return <div className="d04-lesson">
    <nav aria-label="Шлях до уроку" className="d04-breadcrumbs"><Link href="/subjects">Предмети</Link><span aria-hidden="true">/</span><Link href={`/subjects/${topic.subjectId}`}>{topic.subject.name}</Link><span aria-hidden="true">/</span><span aria-current="page">{topic.title}</span></nav>
    <header className="d04-heading"><SubjectIcon id={topic.subjectId} variant="catalog"/><div className="d04-heading-copy"><p className="d04-subject">{topic.subject.name}</p><h1>{topic.title}</h1>{topic.summary.trim()?<MathText text={topic.summary} className="d04-intro"/>:null}<div className="d04-meta">{topic.estimatedMin>0?<span><Clock3 aria-hidden="true"/>Орієнтовно {topic.estimatedMin} хв</span>:null}<Badge>{STATUS_LABEL[status] ?? "Стан уточнюється"}</Badge></div></div></header>
    {topic.children.length?<Card className="d04-material"><h2>Уроки розділу</h2><div className="d04-children">{topic.children.map(child=><Link key={child.id} href={`/learn/${child.id}`}>{child.title}<ArrowRight aria-hidden="true"/></Link>)}</div></Card>:null}

    <LessonTabs variant="lesson" defaultValue={availability.theory||availability.video?"theory":"practice"}
      theory={<div className={topic.videos.length?"d04-study-grid":"d04-study-grid d04-study-without-video"}><LessonTheory lesson={lesson} description={topic.summary}/><section aria-label="Відеопояснення" className="d04-video-column"><VideoPanel topicId={topic.id} topicTitle={`${topic.subject.name} ${topic.title}`} variant="lesson" canEdit={false} videos={topic.videos.map(video=>({...video,notes:video.progress[0]?.notes??"",lastPositionSec:video.progress[0]?.lastPositionSec??0}))}/></section></div>}
      examples={<LessonExamples lesson={lesson}/>}
      practice={<div className="d04-practice"><Card className="d04-material"><div className="d04-section-title"><ClipboardCheck aria-hidden="true"/><h2>Перевірте розуміння теми</h2></div><p className="d04-muted">{practiceNote}</p><TopicActions topicId={topic.id} hasQuestions={verifiedCount>0}/>
        {attempt?<div className="d04-last-result"><p>Остання завершена практика{attempt.finishedAt?` · ${formatUk(attempt.finishedAt)}`:""}</p><p>{attempt.totalCount!==null?`${attempt.correctCount??0} із ${attempt.totalCount} правильних відповідей`:"Результат збережено"}{attempt.pendingCount?` · на перевірці ${attempt.pendingCount}`:""}</p><Link href={`/tests/${attempt.id}`}>Переглянути розбір<ArrowRight aria-hidden="true"/></Link></div>:<p className="d04-empty-copy">Результат з’явиться після завершення практики.</p>}
      </Card><Card className="d04-material d04-completion"><h2>{verifiedCount>0?"Підсумок уроку":"Опрацювання конспекту"}</h2><p className="d04-muted">{STATUS_LABEL[status] ?? "Стан уточнюється"}. Засвоєння теми визначається результатами практики.</p>{lesson?.theory.trim()&&!topic.children.length?<CompleteLesson topicId={topic.id} needsPractice={verifiedCount>0}/>:<p className="d04-empty-copy">Завершення стане доступним після додавання матеріалу уроку.</p>}<p className="d04-review">{review?`Наступне повторення: ${formatUk(review.dueKey)}.`:"Повторення з’явиться після завершення уроку або тесту."}</p></Card>{lesson?.sources?.length?<p className="d04-muted">Авторський навчальний матеріал NMT Academy. Не є офіційним завданням НМТ.</p>:null}</div>}
      notes={<div className="d04-notes-grid"><LessonSynopsis lesson={lesson} summary={topic.summary} formulas={topic.formulas}/><LessonNotes topic={{id:topic.id,title:topic.title,subjectId:topic.subjectId}} notes={topic.notes}/></div>}
    />

    <nav aria-label="Перехід між темами" className="d04-topic-navigation">
      <div>{previous?<Link className="d04-neighbor" href={`/learn/${previous.id}`}><ArrowLeft aria-hidden="true"/><span>Попередня тема<small>{previous.title}</small></span></Link>:<><Button className="d04-neighbor" variant="outline" disabled><ArrowLeft aria-hidden="true"/>Попередня тема</Button><p>Це перша доступна тема в цьому розділі.</p></>}</div>
      <div>{next?<Link className="d04-neighbor d04-neighbor-next" href={`/learn/${next.id}`}><span>Наступна тема<small>{next.title}</small></span><ArrowRight aria-hidden="true"/></Link>:<><Button className="d04-neighbor" variant="outline" disabled>Наступна тема<ArrowRight aria-hidden="true"/></Button><p>Наступного доступного матеріалу ще немає.</p></>}</div>
    </nav>
    <Link href={`/subjects/${topic.subjectId}`} className="d04-back-to-subject">До тем предмета<ArrowRight aria-hidden="true"/></Link>
  </div>;
}
