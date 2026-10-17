"use client";

import { useState } from "react";
import { ELECTIVE_SUBJECT_IDS, REQUIRED_SUBJECT_IDS, SUBJECTS } from "@/lib/constants";
import { claimOwner, completeOnboarding } from "@/server/actions";
import { Button, Card, Input } from "@/components/ui";

const required = SUBJECTS.filter((subject) => (REQUIRED_SUBJECT_IDS as readonly string[]).includes(subject.id));
const electives = SUBJECTS.filter((subject) => (ELECTIVE_SUBJECT_IDS as readonly string[]).includes(subject.id));

export function OnboardingWizard({ claim }: { claim: boolean }) {
  const [step, setStep] = useState(claim ? 1 : 0);
  const [error, setError] = useState("");
  const [elective, setElective] = useState("biology");
  const [intensity, setIntensity] = useState<"light" | "standard" | "intense">("standard");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  async function finish(form: FormData): Promise<void> {
    const result = await completeOnboarding({
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      nickname: String(form.get("nickname") ?? ""),
      password: String(form.get("password") ?? ""),
      examYear: Number(form.get("examYear") ?? 2027),
      targetScore: Number(form.get("targetScore") ?? 150),
      electiveId: elective,
      intensity,
      dailyMinutes: Number(form.get("dailyMinutes") ?? 150),
      preferredTime: String(form.get("preferredTime") ?? "18:00"),
      studyDays: days,
    });
    if (result && !result.ok) setError(result.error);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8">
      <Card className="w-full space-y-5 p-6">
        {step === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">NMT Academy</p>
            <h1 className="text-3xl font-semibold">Твоя персональна платформа підготовки до НМТ</h1>
            <Button onClick={() => setStep(1)}>Розпочати</Button>
            {claim ? <form action={async () => { await claimOwner(); }}><Button type="submit" variant="outline">Це мій наявний прогрес</Button></form> : null}
          </div>
        ) : null}
        {step === 1 ? (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setStep(2); }}>
            <h1 className="text-2xl font-semibold">Профіль</h1>
            <Input name="firstName" placeholder="Ім'я" required minLength={2} form="profile" />
            <Input name="lastName" placeholder="Прізвище" form="profile" />
            <Input name="nickname" placeholder="Нікнейм" required minLength={3} form="profile" />
            <Input name="password" type="password" placeholder="Пароль, щонайменше 8 символів" required minLength={8} form="profile" />
            <Input name="examYear" type="number" defaultValue={2027} form="profile" />
            <Input name="targetScore" type="number" defaultValue={150} form="profile" />
            <Button type="button" onClick={() => setStep(2)}>Далі</Button>
          </form>
        ) : null}
        {step === 2 ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Предмети</h1>
            <div className="grid gap-2 sm:grid-cols-3">
              {required.map((subject) => <div key={subject.id} className="rounded-2xl border border-border p-3"><div className="font-medium">{subject.name}</div><div className="text-xs text-muted-foreground">{"Обов'язковий"}</div></div>)}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {electives.map((subject) => (
                <button key={subject.id} type="button" onClick={() => setElective(subject.id)} className={`rounded-2xl border p-3 text-left ${elective === subject.id ? "border-primary bg-accent" : "border-border"}`}>
                  <span className="mb-2 block h-2 w-2 rounded-full" style={{ background: subject.color }} />
                  <div className="font-medium">{subject.name}</div>
                </button>
              ))}
            </div>
            <Button onClick={() => setStep(3)}>Далі</Button>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Навчальне навантаження</h1>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <button key={day} type="button" className={`rounded-lg border px-3 py-1 text-sm ${days.includes(day) ? "bg-accent" : "border-border"}`} onClick={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}>
                  {["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][day]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(["light", "standard", "intense"] as const).map((item) => <button key={item} type="button" className={`rounded-lg border px-3 py-1 text-sm ${intensity === item ? "bg-accent" : "border-border"}`} onClick={() => setIntensity(item)}>{item === "light" ? "Легка" : item === "intense" ? "Інтенсивна" : "Стандартна"}</button>)}
            </div>
            <Input name="dailyMinutes" type="number" defaultValue={intensity === "light" ? 90 : intensity === "intense" ? 210 : 150} form="profile" />
            <Input name="preferredTime" type="time" defaultValue="18:00" form="profile" />
            <Button onClick={() => setStep(4)}>Далі</Button>
          </div>
        ) : null}
        {step === 4 ? (
          <form id="profile" className="space-y-3" action={finish}>
            <h1 className="text-2xl font-semibold">Створення плану</h1>
            <p className="text-sm text-muted-foreground">Четвертий предмет: {electives.find((subject) => subject.id === elective)?.name}. Інтенсивність: {intensity === "light" ? "легка" : intensity === "intense" ? "інтенсивна" : "стандартна"}.</p>
            <Input name="firstName" placeholder="Ім'я" required minLength={2} />
            <Input name="lastName" placeholder="Прізвище" />
            <Input name="nickname" placeholder="Нікнейм" required minLength={3} />
            <Input name="password" type="password" placeholder="Пароль" required minLength={8} />
            <input type="hidden" name="examYear" value="2027" />
            <input type="hidden" name="targetScore" value="150" />
            <input type="hidden" name="dailyMinutes" value={intensity === "light" ? 90 : intensity === "intense" ? 210 : 150} />
            <input type="hidden" name="preferredTime" value="18:00" />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit">Створити план</Button>
          </form>
        ) : null}
      </Card>
    </main>
  );
}
