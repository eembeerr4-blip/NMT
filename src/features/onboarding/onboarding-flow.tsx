"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenCheck, ExternalLink, Target, Timer, UserRound } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { BaselineForm } from "@/features/baseline/baseline-form";
import {
  beginPersonalOnboarding,
  claimOwner,
  continueAfterDiagnostic,
  createPersonalStudyPlan,
  saveBaselineResult,
  saveOnboardingSubjects,
  savePersonalScheduleDraft,
  saveSubjectTargets,
  skipBaselineDiagnostic,
  type ActionState,
} from "@/server/actions";
import { SUBJECT_RESOURCES } from "./subjects";

type SubjectInfo = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  role: string;
  description: string;
};

type BaselineInfo = {
  id: string;
  subjectId: string;
  date: string;
  title: string;
  ratingScore: number | null;
  rawScore: number | null;
  maxRawScore: number | null;
  belowThreshold: boolean;
  partial: boolean;
  comment: string;
};

type OnboardingData = {
  user: { id: string; firstName: string; lastName: string; nickname: string } | null;
  subjects: SubjectInfo[];
  claimAvailable: boolean;
  step: string;
  electiveId: string | null;
  baselines: BaselineInfo[];
  targets: Record<string, number>;
  preferences: {
    dailyMinutes: number;
    studyDays: number[];
    preferredTime: string;
    planStart: string;
    examDate: string;
  } | null;
  diagnosticSkipped: boolean;
  today: string;
};

const STEPS = ["PROFILE", "SUBJECTS", "DIAGNOSTIC", "TARGETS", "SCHEDULE"];
const DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const dayNames = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота"];

export function OnboardingFlow({ data }: { data: OnboardingData }) {
  const router = useRouter();
  const [step, setStep] = useState(data.step === "PROFILE" && data.user ? "SUBJECTS" : data.step);
  const [electiveId, setElectiveId] = useState(data.electiveId ?? data.subjects.find((item) => item.role === "elective")?.id ?? "");
  const [days, setDays] = useState(data.preferences?.studyDays ?? [1, 2, 3, 4, 5]);
  const [dailyMinutes, setDailyMinutes] = useState(String(data.preferences?.dailyMinutes ?? 60));
  const [preferredTime, setPreferredTime] = useState(data.preferences?.preferredTime ?? "18:00");
  const [planStart, setPlanStart] = useState(data.preferences?.planStart ?? data.today);
  const [examDate, setExamDate] = useState(data.preferences?.examDate ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const requiredSubjects = data.subjects.filter((item) => item.role === "required");
  const activeSubjects = [
    ...requiredSubjects,
    ...data.subjects.filter((item) => item.id === electiveId && item.role === "elective"),
  ];
  const scheduleInput = () => ({
    dailyMinutes: Number(dailyMinutes),
    studyDays: days,
    preferredTime,
    planStart,
    examDate,
  });
  const currentBaselines = new Map(data.baselines.map((result) => [result.subjectId, result]));
  const currentStepIndex = STEPS.indexOf(step);

  async function run(action: Promise<ActionState>, nextStep?: string, onSuccess?: () => void) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (nextStep) setStep(nextStep);
      if (result.message) setNotice(result.message);
      if (onSuccess) onSuccess();
      else router.refresh();
    } catch {
      setError("Не вдалося зберегти дані. Перевір з’єднання й повтори спробу.");
    } finally {
      setBusy(false);
    }
  }

  function back() {
    const previous = STEPS[Math.max(0, currentStepIndex - 1)];
    if (previous) setStep(previous);
    setError("");
    setNotice("");
  }

  const actionButton = (label: string, action: () => Promise<void>) => (
    <Button type="button" disabled={busy} onClick={action}>
      {busy ? "Зберігаємо…" : label}
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );

  if (step === "PROFILE" || !data.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
        <Card className="w-full space-y-6 p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary"><UserRound /></div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">NMT Academy · Персональний старт</p>
            <h1 className="text-3xl font-semibold tracking-tight">Створи свій навчальний профіль</h1>
            <p className="text-sm text-muted-foreground">Після створення профілю кожен крок і результат зберігатиметься окремо для тебе. Діагностику можна пропустити.</p>
          </div>
          <form
            className="grid gap-4 sm:grid-cols-2"
            action={async (formData) => {
              setError("");
              setBusy(true);
              try {
                const result = await beginPersonalOnboarding({
                  firstName: String(formData.get("firstName") ?? ""),
                  lastName: String(formData.get("lastName") ?? ""),
                  nickname: String(formData.get("nickname") ?? ""),
                  password: String(formData.get("password") ?? ""),
                });
                if (result && !result.ok) setError(result.error);
                else {
                  router.push("/onboarding?step=SUBJECTS");
                  router.refresh();
                }
              } catch {
                setError("Не вдалося створити профіль. Перевір введені дані та спробуй ще раз.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="space-y-1 text-sm font-medium">Ім’я<Input name="firstName" autoComplete="given-name" required minLength={2} /></label>
            <label className="space-y-1 text-sm font-medium">Прізвище <span className="text-muted-foreground">(необов’язково)</span><Input name="lastName" autoComplete="family-name" /></label>
            <label className="space-y-1 text-sm font-medium">Нікнейм<Input name="nickname" autoComplete="username" minLength={3} maxLength={24} pattern={"[A-Za-z0-9_\\-]+"} required /></label>
            <label className="space-y-1 text-sm font-medium">Пароль<Input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
            {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Створюємо профіль…" : "Створити профіль і продовжити"}</Button>
            </div>
          </form>
          {data.claimAvailable ? (
            <button type="button" disabled={busy} onClick={() => void run(claimOwner(), undefined, () => {
              router.push("/onboarding?step=SUBJECTS");
              router.refresh();
            })} className="text-sm font-medium text-primary hover:underline">Це мій наявний профіль власника</button>
          ) : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-start px-4 py-8 sm:items-center sm:py-12">
      <Card className="w-full space-y-6 p-5 sm:p-8">
        <header className="space-y-4">
          <p className="text-sm font-medium text-primary">Вітаємо, {data.user.firstName}</p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{stepTitle(step)}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{stepDescription(step)}</p>
            </div>
            <span className="hidden rounded-xl bg-accent p-3 text-primary sm:block"><BookOpenCheck className="h-5 w-5" /></span>
          </div>
          <div className="grid grid-cols-5 gap-1" aria-label={`Крок ${Math.max(1, currentStepIndex + 1)} з 5`}>
            {STEPS.map((item, index) => <div key={item} className={`h-1.5 rounded-full ${index <= currentStepIndex ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <p className="text-xs text-muted-foreground">Крок {Math.max(1, currentStepIndex + 1)} із {STEPS.length}. Збережене залишиться в профілі, навіть якщо ти повернешся пізніше.</p>
        </header>

        {step === "SUBJECTS" ? (
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {requiredSubjects.map((subject) => <div key={subject.id} className="rounded-2xl border border-border bg-secondary p-4"><span className="mb-3 block h-2.5 w-2.5 rounded-full" style={{ background: subject.color }} /><div className="font-semibold">{subject.name}</div><p className="mt-1 text-xs text-muted-foreground">Обов’язковий предмет</p></div>)}
            </div>
            <fieldset className="space-y-3">
              <legend className="font-semibold">Обери четвертий предмет</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.subjects.filter((item) => item.role === "elective").map((subject) => (
                  <button key={subject.id} type="button" onClick={() => setElectiveId(subject.id)} aria-pressed={electiveId === subject.id} className={`rounded-2xl border p-4 text-left transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${electiveId === subject.id ? "border-primary bg-accent" : "border-border bg-card"}`}>
                    <span className="mb-3 block h-2.5 w-2.5 rounded-full" style={{ background: subject.color }} />
                    <span className="block font-semibold">{subject.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{subject.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {data.subjects.filter((item) => item.role === "elective").length === 0 ? <p role="alert" className="text-sm text-destructive">У бібліотеці немає доступних предметів на вибір. Звернися до адміністратора.</p> : null}
            {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end">{actionButton("Зберегти предмети", async () => {
              if (!electiveId) return setError("Оберіть четвертий предмет.");
              await run(saveOnboardingSubjects(electiveId), "DIAGNOSTIC");
            })}</div>
          </section>
        ) : null}

        {step === "DIAGNOSTIC" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-accent p-4">
              <h2 className="font-semibold">Дізнайся свій стартовий рівень</h2>
              <p className="mt-1 text-sm text-muted-foreground">Пройди тренувальні тести з чотирьох предметів, щоб отримати персональний план підготовки. NMT Academy не є офіційним сервісом Освіта.ua і не отримує результати автоматично.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {activeSubjects.map((subject) => {
                const result = currentBaselines.get(subject.id);
                const resource = SUBJECT_RESOURCES[subject.id as keyof typeof SUBJECT_RESOURCES];
                return (
                  <Card key={subject.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><div className="font-semibold">{subject.name}</div><p className="mt-1 text-xs text-muted-foreground">{resource.kind === "catalog" ? "Каталог предмета · Освіта.ua" : "Тренувальні тести · ЗНО.Освіта.ua"}</p></div>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject.color }} />
                    </div>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">Відкрити тести <ExternalLink className="h-4 w-4" /></a>
                    {result ? <p className="text-sm text-muted-foreground">Результат збережено: {result.ratingScore === null ? "рейтинговий бал невідомий" : `${result.ratingScore} рейтингових балів`}{result.partial ? " · частковий тест" : ""}{result.belowThreshold ? " · поріг не подолано" : ""}</p> : <p className="text-sm text-muted-foreground">Результат ще не додано</p>}
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setExpandedResult(expandedResult === subject.id ? null : subject.id)}>{result ? "Змінити стартовий результат" : "Додати результат"}</button>
                    {expandedResult === subject.id ? <BaselineForm subject={subject} initial={result} today={data.today} onSave={async (values) => {
                      await run(saveBaselineResult(values));
                    }} /> : null}
                  </Card>
                );
              })}
            </div>
            {data.diagnosticSkipped ? <p className="text-sm text-muted-foreground">Діагностику вже пропущено. За бажанням додай результати зараз або продовжуй без них.</p> : null}
            {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" disabled={busy} onClick={back}><ArrowLeft className="mr-2 h-4 w-4" />Назад</Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void run(skipBaselineDiagnostic(), "TARGETS")}>Почати без діагностики</Button>
                {actionButton("Продовжити", async () => { await run(continueAfterDiagnostic(), "TARGETS"); })}
              </div>
            </div>
          </section>
        ) : null}

        {step === "TARGETS" ? (
          <TargetForm
            subjects={activeSubjects}
            baselines={currentBaselines}
            initialTargets={data.targets}
            busy={busy}
            error={error}
            notice={notice}
            onBack={back}
            onSave={(targets) => run(saveSubjectTargets(targets), "SCHEDULE")}
          />
        ) : null}

        {step === "SCHEDULE" ? (
          <section className="space-y-5">
            {data.diagnosticSkipped || data.baselines.length === 0 ? <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">Поточний результат невідомий. План можна почати зараз; стартові результати дозволено додати пізніше.</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium"><span className="flex items-center gap-2"><Timer className="h-4 w-4 text-primary" />Час на день</span>
                <select value={["30", "60", "90", "120"].includes(dailyMinutes) ? dailyMinutes : "custom"} onChange={(event) => setDailyMinutes(event.target.value === "custom" ? "150" : event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3">
                  <option value="30">30 хвилин</option><option value="60">1 година</option><option value="90">1,5 години</option><option value="120">2 години</option><option value="custom">Власний варіант</option>
                </select>
                {!["30", "60", "90", "120"].includes(dailyMinutes) ? <Input type="number" min={30} max={240} step={5} value={dailyMinutes} onChange={(event) => setDailyMinutes(event.target.value)} aria-label="Власна тривалість у хвилинах" /> : null}
              </label>
              <label className="space-y-2 text-sm font-medium">Зручний час початку<Input type="time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} /></label>
              <label className="space-y-2 text-sm font-medium">Початок підготовки<Input type="date" value={planStart} onChange={(event) => setPlanStart(event.target.value)} /></label>
              <label className="space-y-2 text-sm font-medium">Дата іспиту <span className="text-muted-foreground">(якщо відома)</span><Input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label>
            </div>
            <fieldset className="space-y-3">
              <legend className="font-semibold">Дні навчання <span className="font-normal text-muted-foreground">(обери щонайменше два)</span></legend>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((label, day) => (
                  <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => a - b))} className={`rounded-xl border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${days.includes(day) ? "border-primary bg-accent text-primary" : "border-border hover:bg-muted"}`}>{label}</button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Обрані дні: {days.length ? days.map((day) => dayNames[day]).join(", ") : "не обрано"}.</p>
            </fieldset>
            <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">Пріоритети плану — внутрішній орієнтир NMT Academy на основі введених цілей і збережених помилок. Це не офіційна методика та не прогноз результату.</p>
            {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-between gap-3">
              <Button type="button" variant="outline" disabled={busy} onClick={back}><ArrowLeft className="mr-2 h-4 w-4" />Назад</Button>
              <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => {
                const parsedMinutes = Number(dailyMinutes);
                if (!Number.isInteger(parsedMinutes) || parsedMinutes < 30 || parsedMinutes > 240) {
                  setError("Укажи від 30 до 240 хвилин на день.");
                  return;
                }
                if (days.length < 2) {
                  setError("Оберіть щонайменше два навчальні дні.");
                  return;
                }
                void run(savePersonalScheduleDraft({ ...scheduleInput(), dailyMinutes: parsedMinutes }));
              }}>Зберегти параметри</Button>
              <Button type="button" disabled={busy} onClick={() => {
                const parsedMinutes = Number(dailyMinutes);
                if (!Number.isInteger(parsedMinutes) || parsedMinutes < 30 || parsedMinutes > 240) {
                  setError("Укажи від 30 до 240 хвилин на день.");
                  return;
                }
                if (days.length < 2) {
                  setError("Оберіть щонайменше два навчальні дні.");
                  return;
                }
                void run(createPersonalStudyPlan({ ...scheduleInput(), dailyMinutes: parsedMinutes }), undefined, () => router.push("/"));
              }}>Створити мій план <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          </section>
        ) : null}
      </Card>
    </main>
  );
}

function TargetForm({ subjects, baselines, initialTargets, busy, error, notice, onBack, onSave }: {
  subjects: SubjectInfo[];
  baselines: Map<string, BaselineInfo>;
  initialTargets: Record<string, number>;
  busy: boolean;
  error: string;
  notice: string;
  onBack: () => void;
  onSave: (targets: { subjectId: string; targetScore: number }[]) => Promise<void>;
}) {
  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const targets = subjects.map((subject) => ({
        subjectId: subject.id,
        targetScore: Number(form.get(`target-${subject.id}`)),
      }));
      if (targets.some((target) => !Number.isInteger(target.targetScore) || target.targetScore < 100 || target.targetScore > 200)) return;
      void onSave(targets);
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {subjects.map((subject) => {
          const baseline = baselines.get(subject.id);
          return (
            <label key={subject.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <span className="block font-semibold">{subject.name}</span>
              <span className="block text-sm text-muted-foreground">{baseline?.ratingScore === null || !baseline ? "Поточний результат невідомий" : `Стартовий рейтинговий бал: ${baseline.ratingScore}`}</span>
              {baseline?.rawScore !== null && baseline?.rawScore !== undefined ? <span className="block text-xs text-muted-foreground">Тестовий бал: {baseline.rawScore}{baseline.maxRawScore === null ? "" : ` із ${baseline.maxRawScore}`}</span> : null}
              <span className="block text-sm font-medium">Бажаний рейтинговий бал</span>
              <Input name={`target-${subject.id}`} type="number" min={100} max={200} required defaultValue={initialTargets[subject.id] ?? ""} aria-label={`Цільовий бал: ${subject.name}`} />
            </label>
          );
        })}
      </div>
      <p className="flex items-center gap-2 rounded-xl bg-secondary p-4 text-sm text-muted-foreground"><Target className="h-4 w-4 shrink-0 text-primary" />Ціль — твоє особисте побажання, не прогноз і не гарантія результату.</p>
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error || "Перевір цільові бали: від 100 до 200."}</p> : null}
      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" disabled={busy} onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Назад</Button>
        <Button type="submit" disabled={busy}>{busy ? "Зберігаємо…" : "Зберегти цілі"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
      </div>
    </form>
  );
}

function stepTitle(step: string) {
  if (step === "SUBJECTS") return "Обери свої предмети";
  if (step === "DIAGNOSTIC") return "Дізнайся свій стартовий рівень";
  if (step === "TARGETS") return "Яких балів ти хочеш досягти?";
  if (step === "SCHEDULE") return "Скільки часу ти готовий приділяти підготовці?";
  return "Твій персональний старт";
}

function stepDescription(step: string) {
  if (step === "SUBJECTS") return "Три обов’язкові предмети та один предмет на вибір. Вибір належить цьому профілю й не впливає на інших.";
  if (step === "DIAGNOSTIC") return "Результати зберігаються лише у твоєму профілі. Їх можна додати частково або пропустити цей крок.";
  if (step === "TARGETS") return "Вкажи окрему ціль для кожного активного предмета. Невідомий стартовий результат не підміняється нулем.";
  if (step === "SCHEDULE") return "План використовує наявні теми й твої вподобання. Завершені та перенесені заняття не видаляються.";
  return "Ці кроки допоможуть підготувати навчальний план саме для тебе.";
}
