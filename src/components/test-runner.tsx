"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { stableShuffle } from "@/lib/grade";
import { finishAttempt, saveDraft } from "@/server/actions";
import { MathText } from "@/components/math-text";
import { Badge, Button, Card, Progress } from "@/components/ui";

type Option = { id: string; label: string; text: string; matchKey: string | null; sortOrder: number };
type PublicQuestion = { id: string; type: string; difficulty: string; prompt: string; options: Option[] };

export function TestRunner({
  attemptId,
  questions,
  initialDraft,
  initialIndex,
  startedAt,
  timeLimitSec,
  timerEnabled,
}: {
  attemptId: string;
  questions: PublicQuestion[];
  initialDraft: Record<string, unknown>;
  initialIndex: number;
  startedAt: string;
  timeLimitSec: number | null;
  timerEnabled: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const base = { ...initialDraft };
    for (const item of questions) {
      if (item.type === "SEQUENCE" && base[item.id] === undefined) {
        base[item.id] = stableShuffle(item.options, `${attemptId}:${item.id}`).map((option) => option.id);
      }
    }
    return base;
  });
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
    window.localStorage.setItem(`attempt:${attemptId}`, JSON.stringify(answers));
    const timer = window.setTimeout(() => {
      void saveDraft(attemptId, answers, index);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [answers, index, attemptId]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  useEffect(() => {
    if (remaining === null || remaining > 0 || autoFinished.current) return;
    autoFinished.current = true;
    void finishAttempt(attemptId, answers).then(() => {
      window.localStorage.removeItem(`attempt:${attemptId}`);
      router.refresh();
    });
  }, [remaining, attemptId, answers, router]);

  const skipped = useMemo(() => questions.filter((item) => answers[item.id] === undefined || answers[item.id] === "" || answers[item.id] === null), [answers, questions]);

  function setAnswer(value: unknown) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  async function finish() {
    setPending(true);
    setError("");
    const result = await finishAttempt(attemptId, answers);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    window.localStorage.removeItem(`attempt:${attemptId}`);
    router.refresh();
  }

  if (!question) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
      <Card className="space-y-5 p-4 sm:p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Завдання {index + 1} з {questions.length}</span>
            {timerEnabled ? <span aria-live="off" className={`rounded-full px-3 py-1 font-medium ${remaining !== null && remaining <= 60 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>{remaining !== null ? `Залишилось ${formatClock(Math.max(0, remaining))}` : `Минуло ${formatClock(elapsed)}`}</span> : null}
          </div>
          <Progress value={((index + 1) / questions.length) * 100} />
        </div>
        <MathText text={question.prompt} />
        <div className="mt-4">
          <AnswerInput question={question} value={answers[question.id]} onChange={setAnswer} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>Назад</Button>
          <Button type="button" variant="outline" onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))} disabled={index === questions.length - 1}>Далі</Button>
          <Button type="button" onClick={() => setConfirmFinish(true)} disabled={pending}>{pending ? "Завершення..." : "Завершити"}</Button>
        </div>
        {confirmFinish ? <div role="alertdialog" aria-labelledby="finish-title" aria-describedby="finish-description" className="space-y-3 rounded-xl border border-border bg-muted p-4"><h2 id="finish-title" className="font-semibold">Завершити тест?</h2><p id="finish-description" className="text-sm text-muted-foreground">{skipped.length ? "Без відповіді залишилося " + skipped.length + " із " + questions.length + " завдань. Ви можете повернутися до них або завершити спробу." : "Усі завдання мають відповідь. Після завершення відкриється результат."}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={()=>setConfirmFinish(false)}>Повернутися до тесту</Button><Button disabled={pending} onClick={()=>void finish()}>{pending?"Завершення…":"Так, завершити тест"}</Button></div></div>:null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </Card>
      <Card className="space-y-3 p-4 lg:sticky lg:top-20 lg:self-start">
        <div><div className="text-sm font-semibold">Навігація</div><div className="mt-1 text-xs text-muted-foreground">Відповіді збережено автоматично</div></div>
        <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-4">
          {questions.map((item, itemIndex) => {
            const answered = answers[item.id] !== undefined && answers[item.id] !== "" && answers[item.id] !== null;
            return (
              <button key={item.id} type="button" aria-current={itemIndex === index ? "step" : undefined} aria-label={`Завдання ${itemIndex + 1}${answered ? ", відповідь є" : ", без відповіді"}`} onClick={() => setIndex(itemIndex)} className={`h-9 rounded-lg border text-xs font-medium ${itemIndex === index ? "border-primary bg-accent text-primary" : answered ? "border-border bg-muted text-foreground" : "border-dashed border-border text-muted-foreground hover:bg-muted"}`}>
                {itemIndex + 1}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Без відповіді: {skipped.length} із {questions.length}.</p>
        <div className="flex flex-wrap gap-1">
          <Badge>{question.difficulty === "EASY" ? "Просте" : question.difficulty === "HARD" ? "Складне" : "Середнє"}</Badge>
        </div>
      </Card>
    </div>
  );
}

function AnswerInput({ question, value, onChange }: { question: PublicQuestion; value: unknown; onChange: (value: unknown) => void }) {
  if (question.type === "SINGLE_CHOICE") {
    return (
      <div className="space-y-2">
        {question.options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3">
            <input type="radio" name={question.id} className="mt-1" checked={value === option.id} onChange={() => onChange(option.id)} />
            <span><span className="mr-2 font-medium">{option.label}.</span><MathText text={option.text} /></span>
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
          <label key={option.id} className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
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
    const order = Array.isArray(value) ? (value as string[]) : question.options.map((option) => option.id);
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
            <div key={optionId} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
              <span>{position + 1}. {option.text}</span>
              <span className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => move(optionId, -1)}>Вгору</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => move(optionId, 1)}>Вниз</Button>
              </span>
            </div>
          );
        })}
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
  return <input className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} aria-label={question.type === "NUMERIC" ? "Числова відповідь" : "Коротка відповідь"} placeholder={question.type === "NUMERIC" ? "Число" : "Коротка відповідь"} />;
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
