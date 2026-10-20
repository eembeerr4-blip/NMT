"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ArrowLeft, ArrowRight, Clock3, Check, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAttemptDraft } from "./use-attempt-draft";
import { answerCompletion } from "@/lib/answer-completion";
import { stableShuffle } from "@/lib/grade";
import { finishAttempt } from "@/server/actions";
import { MathText } from "@/components/math-text";
import { Badge, Button, Card, Progress } from "@/components/ui";

type Option = { id: string; label: string; text: string; matchKey: string | null; sortOrder: number };
type PublicQuestion = { id: string; type: string; difficulty: string; prompt: string; options: Option[] };

export function TestRunner({
  userId,
  attemptId,
  questions,
  initialDraft,
  initialIndex,
  startedAt,
  timeLimitSec,
  timerEnabled,
}: {
  userId: string;
  attemptId: string;
  questions: PublicQuestion[];
  initialDraft: Record<string, unknown>;
  initialIndex: number;
  startedAt: string;
  timeLimitSec: number | null;
  timerEnabled: boolean;
}) {
  const router = useRouter();
  const {view,ready,controller}=useAttemptDraft(userId,attemptId,initialDraft,initialIndex,questions.map(q=>q.id));
  const {answers,index}=view;
  const setIndex=(value:number|((current:number)=>number))=>controller.current?.navigate(typeof value === "function" ? value(index):value);
  const [now, setNow] = useState(() => new Date(startedAt).getTime());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const autoFinished = useRef(false);
  const question = questions[index];
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const remaining = timeLimitSec ? timeLimitSec - elapsed : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if(!ready)return;
    const onLeave=(event:BeforeUnloadEvent)=>{ if(view.status!=="saved"){event.preventDefault();} };
    window.addEventListener("beforeunload",onLeave);
    return()=>window.removeEventListener("beforeunload",onLeave);
  },[ready,view.status]);

  useEffect(() => {
    if (!ready || remaining === null || remaining > 0 || autoFinished.current) return;
    autoFinished.current = true;
    queueMicrotask(() => { void finish(); });
  });

  const skipped = useMemo(() => questions.filter((item) => answerCompletion(item,answers[item.id]) !== "complete"), [answers, questions]);

  function setAnswer(value:unknown) {controller.current?.change(question.id,value);}
  const finishing=useRef(false);
  async function finish() {
    if(finishing.current || !ready || !controller.current)return;
    finishing.current=true;setPending(true);setError("");
    const draft=controller.current;
    await draft.pause();
    try {
      const result=await finishAttempt(attemptId,draft.snapshot().answers);
      if(!result.ok){setError(result.error);draft.resume();return;}
      draft.complete();router.refresh();
    } catch {setError("Не вдалося завершити тест. Відповіді збережені в чернетці. Спробуйте ще раз.");draft.resume();}
    finally {finishing.current=false;setPending(false);}
  }

  if (!question) return null;
  return (
    <AlertDialog.Root open={confirmFinish} onOpenChange={setConfirmFinish}>
      <div className="d05-runner">
        <Card className="d05-question-panel">
          <div className="d05-question-toolbar">
            <span className="d05-eyebrow">Завдання {index + 1} з {questions.length}</span>
            {timerEnabled ? <span aria-live="off" className={`d05-clock ${remaining !== null && remaining <= 60 ? "d05-clock-urgent" : ""}`}><Clock3 aria-hidden="true" size={16} />{remaining !== null ? `Залишилось ${formatClock(Math.max(0, remaining))}` : `Минуло ${formatClock(elapsed)}`}</span> : null}
          </div>
          <Progress value={((index + 1) / questions.length) * 100} label="Поточне завдання" />
          <div className="d05-question-prompt"><MathText text={question.prompt} /></div>
          <fieldset className="d05-answer-fieldset" disabled={pending || !ready}>
            <legend className="sr-only">Відповідь на завдання {index + 1}</legend>
            <AnswerInput sequenceSeed={attemptId+":"+question.id} question={question} value={answers[question.id]} onChange={setAnswer} />
          </fieldset>
          <div className="d05-runner-actions">
            <Button type="button" variant="outline" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}><ArrowLeft aria-hidden="true" />Назад</Button>
            <Button type="button" onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))} disabled={index === questions.length - 1}>Далі<ArrowRight aria-hidden="true" /></Button>
            <AlertDialog.Trigger asChild><Button type="button" variant="outline" disabled={pending || !ready}>{pending ? "Завершення..." : "Завершити"}</Button></AlertDialog.Trigger>
          </div>
          {view.error ? <div role="alert" className="d05-notice d05-error"><p>{view.error}</p><Button type="button" variant="outline" onClick={()=>void controller.current?.flush()}>Повторити збереження</Button></div> : null}
          {error ? <div role="alert" className="d05-notice d05-error"><p>{error}</p><Button type="button" onClick={()=>void finish()} disabled={pending}>Повторити завершення</Button></div> : null}
        </Card>
        <Card className="d05-map-panel">
          <details className="d05-question-map" open>
            <summary>Карта завдань <span>{questions.length-skipped.length}/{questions.length}</span></summary>
            <div role="status" className="d05-save-status">{!ready ? "Відновлення чернетки…" : view.status === "saved" ? "Відповіді збережено" : view.status === "saving" ? "Збереження відповідей…" : view.status === "error" ? "Помилка збереження" : "Є незбережені зміни"}</div>
            <div className="d05-question-grid">
              {questions.map((item, itemIndex) => {
                const completion = answerCompletion(item,answers[item.id]);
                const answered = completion === "complete";
                return <button key={item.id} type="button" data-completion={completion} aria-current={itemIndex === index ? "step" : undefined} aria-label={`Завдання ${itemIndex + 1}${answered ? ", відповідь є" : completion === "partial" ? ", неповна відповідь" : ", без відповіді"}`} onClick={() => setIndex(itemIndex)}>{itemIndex + 1}{answered ? <Check size={10} aria-hidden="true" /> : completion === "partial" ? <span aria-hidden="true">•</span> : null}</button>;
              })}
            </div>
            <div className="d05-map-legend"><span><Check size={13} aria-hidden="true" />Відповідь є</span><span><Circle size={12} aria-hidden="true" />Без відповіді</span><span>• Неповна відповідь</span></div>
          </details>
          <p className="d05-map-count">Без повної відповіді: {skipped.length} із {questions.length}.</p>
          <Badge>{question.difficulty === "EASY" ? "Просте" : question.difficulty === "HARD" ? "Складне" : "Середнє"}</Badge>
        </Card>
      </div>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="d05-overlay" />
        <AlertDialog.Content className="d05-finish-dialog" onEscapeKeyDown={event=>{if(pending)event.preventDefault()}}>
          <AlertDialog.Title className="d05-dialog-title">Завершити тест?</AlertDialog.Title>
          <AlertDialog.Description className="d05-dialog-description">{skipped.length ? "Без повної відповіді залишилося " + skipped.length + " із " + questions.length + " завдань. Ви можете повернутися до них або завершити спробу." : "Усі завдання мають відповідь. Після завершення відкриється результат."}</AlertDialog.Description>
          {error ? <p role="alert" className="d05-notice d05-error">{error}</p> : null}
          <div className="d05-dialog-actions"><AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending}>Повернутися до тесту</Button></AlertDialog.Cancel><Button type="button" disabled={pending} onClick={()=>void finish()}>{pending?"Завершення…":"Так, завершити тест"}</Button></div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function AnswerInput({ sequenceSeed, question, value, onChange }: { sequenceSeed:string; question: PublicQuestion; value: unknown; onChange: (value: unknown) => void }) {
  if (question.type === "SINGLE_CHOICE") {
    return (
      <div className="space-y-2">
        {question.options.map((option) => (
          <label key={option.id} className="d05-choice flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <input type="radio" name={question.id} className="mt-1" checked={value === option.id} onChange={() => onChange(option.id)} />
            <div><span className="mr-2 font-medium">{option.label}.</span><MathText text={option.text} /></div>
          </label>
        ))}
      </div>
    );
  }
  if (question.type === "MATCHING") {
    const left = question.options.filter((option) => option.matchKey === "left");
    const right = question.options.filter((option) => option.matchKey === "right");
    const current = (value && typeof value === "object" ? value : {}) as Record<string, string>;
    return (
      <div className="space-y-3">
        {left.map((option) => (
          <label key={option.id} className="d05-matching-row grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)] sm:items-center">
            <MathText text={option.text} />
            <select className="h-10 rounded-lg border border-border bg-card px-2 text-sm" value={current[option.id] ?? ""} onChange={(event) => onChange({ ...current, [option.id]: event.target.value })}>
              <option value="">Обрати</option>
              {right.map((item) => <option key={item.id} value={item.id}>{item.label}. {item.text.replace(/\$/g, "")}</option>)}
            </select>
          </label>
        ))}
      </div>
    );
  }
  if (question.type === "SEQUENCE") {
    const order = Array.isArray(value) ? (value as string[]) : stableShuffle(question.options,sequenceSeed).map((option) => option.id);
    const move = (optionId: string, direction: number) => {
      const next = [...order];
      const from = next.indexOf(optionId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= next.length) return;
      [next[from], next[to]] = [next[to], next[from]];
      onChange(next);
    };
    return (
      <div className="space-y-2">
        {order.map((optionId, position) => {
          const option = question.options.find((item) => item.id === optionId);
          if (!option) return null;
          return (
            <div key={optionId} className="d05-sequence-row flex items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="d05-sequence-text"><span className="d05-sequence-number">{position + 1}</span><MathText text={option.text} /></div>
              <span className="flex gap-1">
                <Button type="button" size="sm" variant="outline" disabled={position === 0} aria-label={`Перемістити пункт ${position + 1} вгору`} onClick={() => move(optionId, -1)}>Вгору</Button>
                <Button type="button" size="sm" variant="outline" disabled={position === order.length - 1} aria-label={`Перемістити пункт ${position + 1} вниз`} onClick={() => move(optionId, 1)}>Вниз</Button>
              </span>
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={()=>onChange(order)}>Підтвердити поточний порядок</Button>
      </div>
    );
  }
  if (question.type === "STEP_BY_STEP") {
    const current = (value && typeof value === "object" ? value : { work: "", final: "" }) as { work?: string; final?: string };
    return (
      <div className="space-y-3">
        <textarea className="min-h-32 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" aria-label="Хід розв’язання" placeholder="Хід розв'язання" value={current.work ?? ""} onChange={(event) => onChange({ ...current, work: event.target.value })} />
        <input className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" aria-label="Кінцева відповідь" placeholder="Кінцева відповідь" value={current.final ?? ""} onChange={(event) => onChange({ ...current, final: event.target.value })} />
      </div>
    );
  }
  return <label className="d05-text-answer"><span>{question.type === "NUMERIC" ? "Числова відповідь" : "Коротка відповідь"}</span><input inputMode={question.type === "NUMERIC" ? "decimal" : "text"} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} aria-label={question.type === "NUMERIC" ? "Числова відповідь" : "Коротка відповідь"} placeholder={question.type === "NUMERIC" ? "Число" : "Коротка відповідь"} /><small>{question.type === "NUMERIC" ? "Введіть число. Для дробу можна використовувати крапку або кому." : "Запишіть відповідь своїми словами. Може знадобитися ручна перевірка."}</small></label>;
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
