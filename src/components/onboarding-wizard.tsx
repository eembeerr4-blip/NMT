"use client";

import { useEffect, useState } from "react";
import { ELECTIVE_SUBJECT_IDS, REQUIRED_SUBJECT_IDS, SUBJECTS } from "@/lib/constants";
import { claimOwner, completeOnboarding } from "@/server/actions";
import { Button, Card, Input, Label } from "@/components/ui";
import { parseOnboardingDraft, serializeOnboardingDraft } from "@/lib/onboarding-draft";

const required = SUBJECTS.filter((subject) => (REQUIRED_SUBJECT_IDS as readonly string[]).includes(subject.id));
const electives = SUBJECTS.filter((subject) => (ELECTIVE_SUBJECT_IDS as readonly string[]).includes(subject.id));

export function OnboardingWizard({ claim, account }: { claim: boolean; account?: {
  id: string; firstName: string; lastName: string; nickname: string; examYear: number; hasPassword: boolean;
} }) {
  const storageKey = `nmt:onboarding:v1:${account?.id ?? "claim-owner"}`;
  const [step, setStep] = useState(claim ? 1 : 0);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [restoring, setRestoring] = useState(true);
  const [pending, setPending] = useState(false);
  const [elective, setElective] = useState("biology");
  const [intensity, setIntensity] = useState<"light" | "standard" | "intense">("standard");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [profile, setProfile] = useState({ firstName: account?.firstName ?? "", lastName: account?.lastName ?? "", nickname: account?.nickname ?? "", password: "", examYear: account?.examYear ?? 2027, targetScore: 150, dailyMinutes: 150, preferredTime: "18:00" });
  const [targetScoreDraft, setTargetScoreDraft] = useState("150");
  const [dailyMinutesDraft, setDailyMinutesDraft] = useState("150");

  useEffect(() => {
    let active = true;
    let draft = null as ReturnType<typeof parseOnboardingDraft>;
    let warning = "";
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        draft = parseOnboardingDraft(raw);
        if (!draft) warning = "Чернетку не вдалося відновити. Дані вже створеного профілю збережені; перевірте поля перед продовженням.";
      }
    } catch {
      warning = "Браузер не дозволяє відновити чернетку. Поточні поля залишаться на сторінці, але не оновлюйте її до завершення.";
    }
    queueMicrotask(() => {
      if (!active) return;
      if (warning) setStorageWarning(warning);
      if (draft) {
        setStep(draft.step);
        setElective(draft.elective);
        setIntensity(draft.intensity);
        setDays(draft.days);
        setProfile({ ...draft.profile, password: "" });
        setTargetScoreDraft(String(draft.profile.targetScore));
        setDailyMinutesDraft(String(draft.profile.dailyMinutes));
      }
      setRestoring(false);
    });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (restoring) return;
    try { sessionStorage.setItem(storageKey, serializeOnboardingDraft({ step, elective, intensity, days, profile })); }
    catch { queueMicrotask(() => setStorageWarning("Браузер не дозволяє зберегти чернетку. Поточні поля залишаться на сторінці, але не оновлюйте її до завершення.")); }
  }, [storageKey, restoring, step, elective, intensity, days, profile]);

  async function finish() {
    setError("");
    setPending(true);
    try {
      const result = await completeOnboarding({ ...profile, electiveId: elective, intensity, studyDays: days });
      if (result && !result.ok) setError(result.error);
    } finally { setPending(false); }
  }

  return (
    <main className="onboarding-flow mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8">
      <Card className="w-full space-y-5 p-5 sm:p-8">
        {storageWarning ? <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface p-3 text-sm text-danger-text">{storageWarning}</p> : null}
        {restoring ? <p role="status" className="text-sm text-muted-foreground">Відновлення чернетки…</p> : null}
        {!restoring ? <>
        {step === 0 ? <div className="space-y-4">
          <p className="text-sm text-muted-foreground">NMT Academy</p>
          <h1 className="text-3xl font-semibold">Твоя персональна платформа підготовки до НМТ</h1>
          <Button onClick={() => setStep(1)}>Розпочати</Button>
          {claim ? <form action={async () => { await claimOwner(); }}><Button type="submit" variant="outline">Це мій наявний прогрес</Button></form> : null}
        </div> : null}
        {step === 1 ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setError(""); setStep(2); }}>
          <h1 className="text-2xl font-semibold">Профіль</h1>
          <label className="grid gap-1.5 text-sm font-medium">Ім’я<Input name="firstName" aria-label="Ім'я" placeholder="Ім'я" required minLength={2} value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} autoComplete="given-name" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Прізвище<Input name="lastName" aria-label="Прізвище" placeholder="Прізвище" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} autoComplete="family-name" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Нікнейм<Input name="nickname" aria-label="Нікнейм" placeholder="Нікнейм" required minLength={3} maxLength={24} pattern={"[A-Za-z0-9_\\-]{3,24}"} value={profile.nickname} onChange={(e) => setProfile({ ...profile, nickname: e.target.value })} autoComplete="username" /></label>
          {claim && !account?.hasPassword ? <label className="grid gap-1.5 text-sm font-medium">Пароль власника<Input name="password" aria-label="Пароль" type="password" placeholder="Пароль, щонайменше 8 символів" required minLength={8} value={profile.password} onChange={(e) => setProfile({ ...profile, password: e.target.value })} autoComplete="new-password" /></label> : null}
          <Label>Цільовий бал<Input name="targetScore" type="number" inputMode="numeric" required min={100} max={200} value={targetScoreDraft} onChange={(e) => { const next = e.target.value; setTargetScoreDraft(next); if (next !== "") setProfile((current) => ({ ...current, targetScore: Number(next) })); }} /></Label>
          <Button type="submit">Далі</Button>
        </form> : null}
        {step === 2 ? <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Предмети</h1>
          <div className="grid gap-2 sm:grid-cols-3">{required.map((subject) => <div key={subject.id} className="rounded-2xl border border-border p-3"><div className="font-medium">{subject.name}</div><div className="text-xs text-muted-foreground">Обов&apos;язковий</div></div>)}</div>
          <div className="grid gap-2 sm:grid-cols-3">{electives.map((subject) => <button key={subject.id} type="button" aria-pressed={elective === subject.id} onClick={() => setElective(subject.id)} className={`rounded-2xl border p-3 text-left ${elective === subject.id ? "border-primary bg-accent" : "border-border"}`}><span className="mb-2 block h-2 w-2 rounded-full" style={{ background: subject.color }} /><div className="font-medium">{subject.name}</div></button>)}</div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setStep(1)}>Назад</Button><Button onClick={() => setStep(3)}>Далі</Button></div>
        </div> : null}
        {step === 3 ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!days.length) { setError("Оберіть хоча б один навчальний день."); return; } const values = new FormData(event.currentTarget); setProfile((current) => ({ ...current, dailyMinutes: Number(values.get("dailyMinutes")), preferredTime: String(values.get("preferredTime")) })); setError(""); setStep(4); }}>
          <h1 className="text-2xl font-semibold">Навчальне навантаження</h1>
          <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6, 0].map((day) => <button key={day} type="button" aria-pressed={days.includes(day)} className={`rounded-lg border px-3 py-1 text-sm ${days.includes(day) ? "bg-accent" : "border-border"}`} onClick={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}>{["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][day]}</button>)}</div>
          <div className="flex flex-wrap gap-2">{(["light", "standard", "intense"] as const).map((item) => <button key={item} type="button" aria-pressed={intensity === item} className={`rounded-lg border px-3 py-1 text-sm ${intensity === item ? "bg-accent" : "border-border"}`} onClick={() => { const minutes = item === "light" ? 90 : item === "intense" ? 210 : 150; setIntensity(item); setDailyMinutesDraft(String(minutes)); setProfile({ ...profile, dailyMinutes: minutes }); }}>{item === "light" ? "Легка" : item === "intense" ? "Інтенсивна" : "Стандартна"}</button>)}</div>
          <Label>Хвилин на день<Input name="dailyMinutes" type="number" inputMode="numeric" required min={15} max={720} value={dailyMinutesDraft} onChange={(e) => { const next = e.target.value; setDailyMinutesDraft(next); if (next !== "") setProfile((current) => ({ ...current, dailyMinutes: Number(next) })); }} /></Label>
          <Label>Зручний час<Input name="preferredTime" type="time" required value={profile.preferredTime} onChange={(e) => setProfile({ ...profile, preferredTime: e.target.value })} /></Label>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setStep(2)}>Назад</Button><Button type="submit">Далі</Button></div>
        </form> : null}
        {step === 4 ? <form className="space-y-3" action={finish}>
          <h1 className="text-2xl font-semibold">Створення плану</h1>
          <p>Профіль: {profile.firstName} {profile.lastName} · {profile.nickname}</p>
          <p>Ціль: {profile.targetScore} балів.</p>
          <p>Четвертий предмет: {electives.find((subject) => subject.id === elective)?.name}.</p>
          <p>{profile.dailyMinutes} хв на день · {profile.preferredTime} · {days.length} навчальних днів на тиждень.</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setStep(3)}>Назад</Button><Button type="submit" disabled={pending}>{pending ? "Створення…" : "Створити план"}</Button></div>
        </form> : null}
        </> : null}
      </Card>
    </main>
  );
}
