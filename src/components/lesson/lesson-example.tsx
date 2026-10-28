"use client";

import { useId, useState } from "react";
import { checkLessonExample, revealLessonExample } from "@/server/lesson-examples";
import { Button, Card, Input } from "@/components/ui";
import { LessonText } from "./lesson-text";

export function LessonExample({topicId,task,canCheck,index}:{topicId:string;task:string;canCheck:boolean;index:number}) {
  const id=useId();
  const [answer,setAnswer]=useState("");
  const [correct,setCorrect]=useState<boolean|null>(null);
  const [solution,setSolution]=useState<string|null>(null);
  const [showSolution,setShowSolution]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  return <Card role="article" aria-label={"Приклад "+(index+1)} className="d04-material d04-reading">
    <div className="d04-section-title"><span className="d04-example-number">{index+1}</span><h2>Приклад {index+1}</h2></div>
    <div className="d04-example-task"><h3>Умова</h3><LessonText text={task}/></div>
    {canCheck?<form className="d04-example-answer" onSubmit={async event=>{
      event.preventDefault();setPending(true);setError("");
      try {const result=await checkLessonExample(topicId,index,task,answer);if(result.ok)setCorrect(result.correct);else setError(result.error);}
      catch {setError("Не вдалося перевірити відповідь. Спробуйте ще раз.");}
      finally {setPending(false);}
    }}>
      <label htmlFor={id+"-answer"}>Ваша відповідь</label>
      <div className="d04-example-input-row"><Input id={id+"-answer"} type="text" autoComplete="off" required maxLength={200} disabled={pending} value={answer} aria-describedby={id+"-feedback"} onChange={event=>{setAnswer(event.target.value);setCorrect(null);setError("");}}/>
      <Button type="submit" disabled={pending||!answer.trim()}>{pending?"Перевірка…":"Перевірити відповідь"}</Button></div>
      <p id={id+"-feedback"} role="status" className="d04-example-feedback">{error|| (correct===null?"":correct?"Правильно! Молодець.":"Неправильно. Спробуйте ще раз або перегляньте розв'язання.")}</p>
    </form>:null}
    {!canCheck&&error?<p role="alert">{error}</p>:null}
    <Button type="button" variant="outline" disabled={pending} aria-expanded={showSolution} aria-controls={id+"-solution"} onClick={async()=>{
      if(showSolution){setShowSolution(false);return;}
      if(solution!==null){setShowSolution(true);return;}
      setPending(true);setError("");
      try {const result=await revealLessonExample(topicId,index,task);if(result.ok){setSolution(result.solution);setShowSolution(true);}else setError(result.error);}
      catch {setError("Не вдалося завантажити розв’язання. Спробуйте ще раз.");}
      finally {setPending(false);}
    }}>{showSolution?"Приховати розв’язання":"Переглянути розв'язання"}</Button>
    <div id={id+"-solution"} hidden={!showSolution} className="d04-example-solution">{showSolution&&solution!==null?<><h3>Розв’язання</h3><LessonText text={solution}/></>:null}</div>
  </Card>;
}
