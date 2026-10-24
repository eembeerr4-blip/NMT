"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, unstable_rethrow } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SUBJECTS } from "@/lib/constants";
import { examResultSchema, preferencesSchema } from "@/lib/validators";
import { createTopic, importQuestions, logStudyMinutes, saveExamResult, saveFormat, savePreferences, saveQuestion, saveSchedule, startExam, startTopicTest, updateTopic } from "@/server/actions";
import { Button, Input, Textarea } from "@/components/ui";
import { useActionFeedback } from "./use-action-feedback";

type ResultValues = z.infer<typeof examResultSchema>;

export function ResultForm({ initial }: { initial?: Partial<ResultValues> & { id?: string } }) {
  const router = useRouter();
  const form = useForm<ResultValues>({
    resolver: zodResolver(examResultSchema),
    defaultValues: {
      id: initial?.id,
      date: initial?.date ?? new Date().toISOString().slice(0, 10),
      subjectId: initial?.subjectId ?? "math",
      testType: initial?.testType ?? "FULL_MOCK",
      title: initial?.title ?? "",
      source: initial?.source ?? "",
      rawScore: initial?.rawScore ?? null,
      maxRawScore: initial?.maxRawScore ?? null,
      ratingScore: initial?.ratingScore ?? null,
      belowThreshold: initial?.belowThreshold ?? false,
      partial: initial?.partial ?? false,
      countsTowardAverage: initial?.countsTowardAverage ?? false,
      durationMin: initial?.durationMin ?? null,
      errorCount: initial?.errorCount ?? null,
      comment: initial?.comment ?? "",
    },
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (values) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const result = await saveExamResult(values);
        if (!result.ok) setError(result.error);
        else { form.reset(); router.push("/results"); router.refresh(); }
      } finally {
        setSubmitting(false);
      }
    })}>
      <p className="text-sm text-muted-foreground sm:col-span-2">Тестовий і рейтинговий бали зберігаються окремо. Обов’язкові поля залежать від типу запису.</p>
      <Field label="Дата"><Input type="date" {...form.register("date")} /></Field>
      <Field label="Предмет">
        <select className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" {...form.register("subjectId")}>
          {SUBJECTS.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </Field>
      <Field label="Тип тестування">
        <select className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" {...form.register("testType")}>
          <option value="DIAGNOSTIC">Діагностика</option>
          <option value="FULL_MOCK">Повний пробник</option>
          <option value="PARTIAL">Частковий тест</option>
          <option value="MANUAL">Інший запис</option>
        </select>
      </Field>
      <Field label="Назва пробника"><Input {...form.register("title")} placeholder="Наприклад, пробник від школи" /></Field>
      <NumberField label="Тестовий бал" name="rawScore" form={form} />
      <NumberField label="Рейтинговий бал (100–200)" name="ratingScore" form={form} />
      <details className="sm:col-span-2 rounded-xl border border-border bg-background/30 p-3">
        <summary className="cursor-pointer text-sm font-medium">Додаткові параметри</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Джерело"><Input {...form.register("source")} /></Field>
          <NumberField label="Максимум тестових балів" name="maxRawScore" form={form} />
          <NumberField label="Час, хв" name="durationMin" form={form} />
          <NumberField label="Кількість помилок" name="errorCount" form={form} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("belowThreshold")} /> Нижче порогового</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("partial")} /> Частковий тест</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...form.register("countsTowardAverage")} /> Враховувати в середньому рейтинговому балі</label>
          <Field label="Коментар" className="sm:col-span-2"><Textarea {...form.register("comment")} /></Field>
        </div>
      </details>
      {error || Object.values(form.formState.errors).some((item) => item?.message) ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error || Object.values(form.formState.errors).find((item) => item?.message)?.message}</p> : null}
      <div className="sm:col-span-2"><Button type="submit" disabled={form.formState.isSubmitting || submitting}>{form.formState.isSubmitting || submitting ? "Збереження…" : "Зберегти результат"}</Button></div>
    </form>
  );
}

function NumberField({ label, name, form }: { label: string; name: "rawScore" | "maxRawScore" | "ratingScore" | "durationMin" | "errorCount"; form: ReturnType<typeof useForm<ResultValues>> }) {
  return (
    <Field label={label}>
      <Input inputMode="numeric" {...form.register(name, { setValueAs: (value) => value === "" || value === null ? null : Number(value) })} />
    </Field>
  );
}

type QuestionInitial = {
  id: string;
  subjectId: string;
  topicId: string | null;
  subtopic: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  correctAnswer: string;
  source: string;
  verificationStatus: string;
  options: { id?: string; label: string; text: string; matchKey: string | null }[];
};

export function QuestionForm({ topics, initial, returnTo = "/admin/questions" }: { topics: { id: string; title: string; subjectId: string }[]; initial?: QuestionInitial; returnTo?: "/admin/questions" | "/editor/questions" }) {
  const router = useRouter();
  const [subject, setSubject] = useState(initial?.subjectId ?? "ukrainian");
  const [message, setMessage] = useState("");
  return (
    <form className="grid gap-3" onSubmit={async (event) => {
      event.preventDefault();
      const submittedForm = event.currentTarget;
      const form = new FormData(submittedForm);
      const lines = String(form.get("options") ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
      const options = lines.map((line) => {
        const [label, text, matchKey] = line.split("|");
        const previous = initial?.options.find(option => option.label === label.trim());
        return { id: previous?.id, label: label.trim(), text: (text ?? "").trim(), matchKey: matchKey?.trim() || undefined };
      });
      const result = await saveQuestion({
        id: String(form.get("id") || "") || undefined,
        subjectId: String(form.get("subjectId")),
        topicId: String(form.get("topicId")),
        subtopic: String(form.get("subtopic") ?? ""),
        type: String(form.get("type")),
        difficulty: String(form.get("difficulty")),
        prompt: String(form.get("prompt") ?? ""),
        explanation: String(form.get("explanation") ?? ""),
        correctAnswer: String(form.get("correctAnswer") ?? ""),
        source: String(form.get("source") ?? ""),
        verificationStatus: String(form.get("verificationStatus")),
        options,
      });
      setMessage(result.ok ? (initial ? "Зміни завдання збережено." : "Завдання збережено.") : result.error);
      if (result.ok) {
        if (initial) router.push(returnTo);
        else { submittedForm.reset(); setSubject("ukrainian"); }
      }
    }}>
      {initial ? <input type="hidden" name="id" value={initial.id}/> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Предмет"><select name="subjectId" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={subject} onChange={event=>setSubject(event.target.value)}>{SUBJECTS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Тема">
          <select name="topicId" defaultValue={initial?.topicId ?? topics.find((topic)=>topic.subjectId===subject)?.id ?? ""} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
            {topics.filter(topic=>topic.subjectId===subject).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </Field>
        <Field label="Тип">
          <select name="type" defaultValue={initial?.type ?? "SINGLE_CHOICE"} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
            <option value="SINGLE_CHOICE">Одна відповідь</option>
            <option value="MATCHING">Відповідність</option>
            <option value="SEQUENCE">Послідовність</option>
            <option value="NUMERIC">Число</option>
            <option value="SHORT_TEXT">Короткий текст</option>
            <option value="STEP_BY_STEP">Покрокова задача</option>
          </select>
        </Field>
        <Field label="Складність">
          <select name="difficulty" defaultValue={initial?.difficulty ?? "EASY"} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
            <option value="EASY">Просте</option>
            <option value="MEDIUM">Середнє</option>
            <option value="HARD">Складне</option>
          </select>
        </Field>
      </div>
      <Field label="Умова"><Textarea name="prompt" defaultValue={initial?.prompt} required /></Field>
      <Field label="Пояснення"><Textarea name="explanation" defaultValue={initial?.explanation} required /></Field>
      <Field label="Правильна відповідь"><Input name="correctAnswer" defaultValue={initial?.correctAnswer} required placeholder="Мітка варіанта (А), число, текст або JSON з мітками" /></Field>
      <Field label="Варіанти, по одному в рядку: мітка|текст|left або right"><Textarea name="options" defaultValue={initial?.options.map((option)=>`${option.label}|${option.text}|${option.matchKey??""}`).join("\n")} /></Field>
      <Field label="Джерело"><Input name="source" defaultValue={initial?.source} placeholder="Не пишіть «офіційне», якщо це не так" /></Field>
      <input type="hidden" name="subtopic" value={initial?.subtopic ?? ""} />
      <Field label="Статус">
        <select name="verificationStatus" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" defaultValue={initial?.verificationStatus === "VERIFIED" ? "PENDING_REVIEW" : initial?.verificationStatus ?? "DRAFT"}>
          <option value="DRAFT">Чернетка</option>
          <option value="PENDING_REVIEW">Очікує перевірки</option>
          <option value="VERIFIED">Перевірено</option>
          <option value="REJECTED">Відхилено</option>
        </select>
      </Field>
      <Button type="submit">{initial ? "Зберегти зміни" : "Створити завдання"}</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function ImportQuestionsForm() {
  const [message, setMessage] = useState("");
  const [pending,setPending]=useState(false);
  return (
    <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      try { const result = await importQuestions(String(new FormData(event.currentTarget).get("json") ?? ""));
      setMessage(result.ok ? result.message ?? "Імпортовано." : result.error); } finally { setPending(false); }
    }}>
      <Textarea name="json" placeholder='[{"subjectId":"math","topicId":"math-linear-eq","type":"NUMERIC","difficulty":"EASY","prompt":"...","explanation":"...","correctAnswer":"1","verificationStatus":"PENDING_REVIEW","options":[]}]' />
      <Button type="submit" disabled={pending} variant="outline">{pending?"Імпортування…":"Імпортувати JSON"}</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function TopicEditor({ topic }: { topic: { id: string; subjectId: string; title: string; summary: string; formulas: string; status: string } }) {
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-4">
      <form className="grid gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const submittedForm = event.currentTarget;
      const form = new FormData(submittedForm);
        const result = await updateTopic({
          id: topic.id,
          title: String(form.get("title") ?? ""),
          summary: String(form.get("summary") ?? ""),
          formulas: String(form.get("formulas") ?? ""),
          status: String(form.get("status") ?? "NOT_STARTED"),
        });
        setMessage(result.ok ? result.message ?? "Тему оновлено." : result.error);
      }}>
        <Input name="title" defaultValue={topic.title} required />
        <select name="status" defaultValue={topic.status} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
          <option value="NOT_STARTED">Не розпочато</option>
          <option value="IN_PROGRESS">Вивчається</option>
          <option value="NEEDS_REVIEW">Потрібне повторення</option>
          <option value="MASTERED">Засвоєно</option>
        </select>
        <Textarea name="summary" defaultValue={topic.summary} />
        <Textarea name="formulas" defaultValue={topic.formulas} placeholder="Формули в $...$" />
        <Button type="submit" variant="outline">Зберегти тему</Button>
      </form>
      <form className="grid gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const submittedForm = event.currentTarget;
      const form = new FormData(submittedForm);
        const result = await createTopic({ subjectId: topic.subjectId, parentId: topic.id, title: String(form.get("title") ?? ""), summary: String(form.get("summary") ?? "") });
        setMessage(result.ok ? "Підтему створено." : result.error);
        if (result.ok) submittedForm.reset();
      }}>
        <Input name="title" placeholder="Нова підтема" required />
        <Textarea name="summary" placeholder="Короткий опис" />
        <Button type="submit" variant="outline">Додати підтему</Button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

export function TopicActions({ topicId, hasQuestions }: { topicId: string; hasQuestions: boolean }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <form action={async () => {
        setMessage("");
        try {
          const result = await startTopicTest(topicId);
          if (result && !result.ok) setMessage(result.error);
        } catch (cause) {
          unstable_rethrow(cause);
          setMessage("Не вдалося розпочати тест. Перевірте з’єднання та повторіть.");
        }
      }}>
        <Button type="submit" disabled={!hasQuestions}>Пройти тест</Button>
      </form>
      {!hasQuestions ? <p className="text-sm text-muted-foreground">Перевірених завдань ще немає.</p> : null}
      {message ? <p role="alert" className="text-sm text-danger-text">{message}</p> : null}
    </div>
  );
}

export function ExamStartForm() {
  const [message, setMessage] = useState("");
  const [pending,setPending]=useState(false);
  const submitting=useRef(false);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (event) => {
      event.preventDefault();
      if(submitting.current)return;
      submitting.current=true;setPending(true);setMessage("");
      try {
      const submittedForm = event.currentTarget;
      const form = new FormData(submittedForm);
      const result = await startExam({
        subjectId: String(form.get("subjectId")),
        title: String(form.get("title") ?? ""),
        count: Number(form.get("count") ?? 12),
        minutes: form.get("minutes") ? Number(form.get("minutes")) : null,
      });
      if (result && !result.ok) setMessage(result.error);
      } catch(error) { unstable_rethrow(error);setMessage("Не вдалося розпочати пробник. Перевірте з’єднання та повторіть."); }
      finally {submitting.current=false;setPending(false);}
    }}>
      <Field label="Предмет"><SubjectSelect /></Field>
      <Field label="Назва"><Input name="title" placeholder="Мій пробник" /></Field>
      <Field label="Скільки завдань взяти з банку"><Input name="count" type="number" min={1} max={60} defaultValue={12} /></Field>
      <Field label="Ліміт часу, хв"><Input name="minutes" type="number" min={1} placeholder="Необов'язково" /></Field>
      <p className="text-sm text-muted-foreground sm:col-span-2">Формат НМТ-2027 у конфігурації не підтверджено. Пробник бере лише перевірені завдання з банку і не переводить їх у рейтинговий бал.</p>
      <Button type="submit" disabled={pending}>{pending ? "Підготовка…" : "Почати пробник"}</Button>
      {message ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{message}</p> : null}
    </form>
  );
}

const preferenceFormSchema = preferencesSchema;
type PreferenceValues = z.infer<typeof preferenceFormSchema>;

export function SettingsForm({ values, showTheme = true }: { values: PreferenceValues; showTheme?: boolean }) {
  const form = useForm<PreferenceValues>({ resolver: zodResolver(preferenceFormSchema), defaultValues: values });
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-8">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (data) => {
        const result = await savePreferences(data);
        setMessage(result.ok ? result.message ?? "Збережено." : result.error);
      })}>
        {showTheme ? <Field label="Тема">
          <select className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" {...form.register("theme")}>
            <option value="system">Системна</option>
            <option value="light">Світла</option>
            <option value="dark">Темна</option>
          </select>
        </Field> : null}
        <Field label="Моя навчальна ціль (рейтинговий бал)">
          <Input type="number" min={100} max={200} {...form.register("targetScore", { valueAsNumber: true })} />
        </Field>
        <div className="flex items-center">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("timerEnabled")} /> Показувати таймер у тестах</label>
        </div>
        <input type="hidden" {...form.register("examDate")} />
        <input type="hidden" {...form.register("masteryHighMin", { valueAsNumber: true })} />
        <input type="hidden" {...form.register("masteryMidMin", { valueAsNumber: true })} />
        <input type="hidden" {...form.register("mathPriority", { valueAsNumber: true })} />
        <input type="hidden" {...form.register("ukrainianPriority", { valueAsNumber: true })} />
        <input type="hidden" {...form.register("historyPriority", { valueAsNumber: true })} />
        <input type="hidden" {...form.register("biologyPriority", { valueAsNumber: true })} />
        <p className="text-sm text-muted-foreground sm:col-span-2">Технічні параметри плану залишаються без змін. Ціль тут застосовується до загального навчального плану.</p>
        <div className="sm:col-span-2"><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Збереження…" : "Зберегти налаштування"}</Button></div>
      </form>
      {Object.values(form.formState.errors).some(error=>error?.message)?<p role="alert" className="text-sm text-danger-text">{Object.values(form.formState.errors).find(error=>error?.message)?.message}</p>:null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

export function PlatformConfigForm({ scheduleJson, formatJson }: { scheduleJson: string; formatJson: string }) {
  return (
    <div className="space-y-4">
      <JsonSaver title="Конфігурація розкладу" initial={scheduleJson} action={saveSchedule} />
      <JsonSaver title="Формат і таблиці оцінювання" initial={formatJson} action={saveFormat} />
    </div>
  );
}

function JsonSaver({ title, initial, action }: { title: string; initial: string; action: (value: string) => Promise<{ ok: boolean; error?: string; message?: string }> }) {
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      const result = await action(value);
      setMessage(result.ok ? result.message ?? "Збережено." : result.error ?? "Помилка");
    }}>
      <h2 className="font-medium">{title}</h2>
      <Textarea value={value} onChange={(event) => setValue(event.target.value)} className="min-h-40 font-mono text-xs" />
      <Button type="submit" variant="outline">Зберегти JSON</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function StudyLogForm({ subjectId, topicId }: { subjectId?: string; topicId?: string }) {
  const {pending,result,run}=useActionFeedback();
  return (
    <form className="flex flex-wrap gap-2" onSubmit={async (event) => {
      event.preventDefault();
      const minutes = Number(new FormData(event.currentTarget).get("minutes"));
      await run(()=>logStudyMinutes({ subjectId, topicId, minutes }));
    }}>
      <label className="grid gap-1 text-sm"><span>Тривалість, хв</span><Input name="minutes" type="number" min={1} placeholder="Хвилини" className="w-32" required disabled={pending}/></label>
      <Button type="submit" variant="outline" disabled={pending}>{pending?"Збереження…":"Записати час"}</Button>
      {result ? <span role={result.ok?"status":"alert"} className="text-sm text-muted-foreground">{result.ok?"Час записано.":result.error}</span> : null}
    </form>
  );
}

export { BackupRestoreForm } from "@/components/backup-restore";

function SubjectSelect({ optional = false }: { optional?: boolean }) {
  return (
    <select name="subjectId" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
      {optional ? <option value="">Без предмета</option> : null}
      {SUBJECTS.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
    </select>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
