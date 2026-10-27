"use client";

import { useId, useState } from "react";
import type { LessonContent } from "@/lib/lesson";
import { checkExampleAnswer } from "@/lib/example-answer";
import { Button, Card, Input } from "@/components/ui";
import { LessonText } from "./lesson-text";

export function LessonExample({ example, index }: { example: LessonContent["examples"][number]; index: number }) {
  const id = useId();
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  return <Card role="article" aria-label={"Приклад " + (index + 1)} className="d04-material d04-reading">
    <div className="d04-section-title"><span className="d04-example-number">{index + 1}</span><h2>Приклад {index + 1}</h2></div>
    <div className="d04-example-task"><h3>Умова</h3><LessonText text={example.task}/></div>
    {example.answerCheck ? <form className="d04-example-answer" onSubmit={event => {
      event.preventDefault();
      setCorrect(checkExampleAnswer(answer, example.answerCheck!));
    }}>
      <label htmlFor={id + "-answer"}>Ваша відповідь</label>
      <div className="d04-example-input-row"><Input id={id + "-answer"} type="text" autoComplete="off" required maxLength={200} value={answer} aria-describedby={id + "-feedback"} onChange={event => { setAnswer(event.target.value); setCorrect(null); }}/>
      <Button type="submit" disabled={!answer.trim()}>Перевірити відповідь</Button></div>
      <p id={id + "-feedback"} role="status" className="d04-example-feedback">{correct === null ? "" : correct ? "Правильно! Молодець." : "Неправильно. Спробуйте ще раз або перегляньте розв'язання."}</p>
    </form> : null}
    <Button type="button" variant="outline" aria-expanded={showSolution} aria-controls={id + "-solution"} onClick={() => setShowSolution(!showSolution)}>{showSolution ? "Приховати розв’язання" : "Переглянути розв'язання"}</Button>
    <div id={id + "-solution"} hidden={!showSolution} className="d04-example-solution"><h3>Розв’язання</h3><LessonText text={example.solution}/></div>
  </Card>;
}
