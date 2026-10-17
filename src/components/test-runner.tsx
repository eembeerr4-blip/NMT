"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { stableShuffle } from "@/lib/grade";
import { finishAttempt, saveDraft } from "@/server/actions";
import { MathText } from "@/components/math-text";
import { Badge, Button, Card } from "@/components/ui";

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
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
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
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Завдання {index + 1} з {questions.length}</span>
          {timerEnabled ? <span>{remaining !== null ? `Залишилось ${formatClock(Math.max(0, remaining))}` : `Минуло ${formatClock(elapsed)}`}</span> : null}
        </div>
        <MathText text={question.prompt} />
        <div className="mt-4">
          <AnswerInput question={question} value={answers[question.id]} onChange={setAnswer} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>Назад</Button>
          <Button type="button" variant="outline" onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))} disabled={index === questions.length - 1}>Далі</Button>
          <Button type="button" onClick={() => void finish()} disabled={pending}>{pending ? "Завершення..." : "Завершити"}</Button>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </Card>
      <Card className="p-3">
        <div className="mb-2 text-sm font-medium">Навігація</div>
        <div className="grid grid-cols-6 gap-1 lg:grid-cols-4">
          {questions.map((item, itemIndex) => {
            const answered = answers[item.id] !== undefined && answers[item.id] !== "" && answers[item.id] !== null;
            return (
              <button key={item.id} type="button" onClick={() => setIndex(itemIndex)} className={`h-8 rounded-md border text-xs ${itemIndex === index ? "border-primary bg-accent" : answered ? "bg-muted" : "border-dashed"}`}>
                {itemIndex + 1}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Пропущено: {skipped.length}. Чернетка зберігається автоматично.</p>
        <div className="mt-2 flex flex-wrap gap-1">
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
        <textarea className="min-h-32 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" placeholder="Хід розв'язання" value={current.work ?? ""} onChange={(event) => onChange({ ...current, work: event.target.value })} />
        <input className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" placeholder="Кінцева відповідь" value={current.final ?? ""} onChange={(event) => onChange({ ...current, final: event.target.value })} />
      </div>
    );
  }
  return <input className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} placeholder={question.type === "NUMERIC" ? "Число" : "Коротка відповідь"} />;
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
