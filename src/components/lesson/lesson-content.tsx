import { BookOpen, FileText } from "lucide-react";
import { MathText } from "@/components/math-text";
import { Card } from "@/components/ui";
import type { LessonContent } from "@/lib/lesson";

export function LessonTheory({lesson,description}:{lesson:LessonContent|null;description:string}) {
  return <Card className="d04-material d04-reading">
    <div className="d04-section-title"><BookOpen aria-hidden="true"/><h2>Теорія</h2></div>
    {lesson?.objectives.length?<div className="d04-objectives"><h3>Після уроку ви зможете</h3><ul>{lesson.objectives.map((text,index)=><li key={index}><MathText text={text}/></li>)}</ul></div>:null}
    {lesson?.theory.trim()?<MathText text={lesson.theory}/>:<div className="d04-empty"><h3>Теорію ще готують</h3><p>Скористайтеся доступним відео або практикою цієї теми.</p>{description?<MathText text={description}/>:null}</div>}
    {lesson?.sources?.length?<details className="d04-sources"><summary>Джерела матеріалу</summary>{lesson.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</details>:null}
  </Card>;
}

export function LessonExamples({lesson}:{lesson:LessonContent|null}) {
  if(!lesson?.examples.length)return <Card className="d04-material d04-empty"><h2>Приклади ще готуються</h2><p>Для цієї теми приклади ще не додані. Перейдіть до доступної теорії або практики.</p></Card>;
  return <div className="d04-examples">{lesson.examples.map((example,index)=><Card key={index} className="d04-material d04-reading"><div className="d04-section-title"><span className="d04-example-number">{index+1}</span><h2>Приклад {index+1}</h2></div><div className="d04-example-task"><h3>Умова</h3><MathText text={example.task}/></div><div className="d04-example-solution"><h3>Розв’язання</h3><MathText text={example.solution}/></div></Card>)}</div>;
}

export function LessonSynopsis({lesson,summary,formulas}:{lesson:LessonContent|null;summary:string;formulas:string}) {
  const hasSynopsis=Boolean(lesson?.summary.trim()||summary.trim()||formulas.trim()||lesson?.rules.length||lesson?.mistakes.length);
  return <Card className="d04-material d04-reading"><div className="d04-section-title"><FileText aria-hidden="true"/><h2>Навчальний конспект</h2></div>
    {!hasSynopsis?<div className="d04-empty"><p>{lesson?.theory.trim()?"Окремого короткого конспекту ще немає. Повний матеріал доступний у вкладці «Теорія».":"Навчальний конспект ще готується. Скористайтеся іншими доступними матеріалами теми."}</p></div>:<>
      {lesson?.summary.trim()||summary.trim()?<MathText text={lesson?.summary.trim()?lesson.summary:summary}/>:null}
      {lesson?.rules.length?<section><h3>Головні правила</h3><ul className="d04-rule-list">{lesson.rules.map((rule,index)=><li key={index}><MathText text={rule}/></li>)}</ul></section>:null}
      {formulas.trim()?<section><h3>Формули</h3><MathText text={formulas}/></section>:null}
      {lesson?.mistakes.length?<section><h3>Типові помилки</h3><ul className="d04-rule-list">{lesson.mistakes.map((mistake,index)=><li key={index}><MathText text={mistake}/></li>)}</ul></section>:null}
      {lesson?.notes?.trim()?<section><h3>Додаткові примітки</h3><MathText text={lesson.notes}/></section>:null}
    </>}
  </Card>;
}
