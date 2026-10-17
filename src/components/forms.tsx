"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SUBJECTS } from "@/lib/constants";
import { examResultSchema, preferencesSchema } from "@/lib/validators";
import { askTutor, createCustomTask, createTopic, importQuestions, logStudyMinutes, saveExamResult, saveFormat, saveGeneratedQuestions, saveNote, savePreferences, saveQuestion, saveSchedule, saveSecretSettings, startExam, startTopicTest, updateTopic } from "@/server/actions";
import { Button, Input, Label, Textarea } from "@/components/ui";

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
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (values) => {
      const result = await saveExamResult(values);
      if (!result.ok) setError(result.error);
      else router.push("/results");
    })}>
      <Field label="Дата"><Input type="date" {...form.register("date")} /></Field>
      <Field label="Предмет">
        <select className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" {...form.register("subjectId")}>
          {SUBJECTS.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </Field>
      <Field label="Тип тесту">
        <select className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" {...form.register("testType")}>
          <option value="DIAGNOSTIC">Діагностика</option>
          <option value="FULL_MOCK">Повний пробник</option>
          <option value="PARTIAL">Частковий тест</option>
          <option value="MANUAL">Інший запис</option>
        </select>
      </Field>
      <Field label="Назва або джерело пробника"><Input {...form.register("title")} /></Field>
      <Field label="Джерело"><Input {...form.register("source")} /></Field>
      <NumberField label="Тестовий бал" name="rawScore" form={form} />
      <NumberField label="Максимум тестових балів" name="maxRawScore" form={form} />
      <NumberField label="Рейтинговий бал, якщо відомий" name="ratingScore" form={form} />
      <NumberField label="Час, хв" name="durationMin" form={form} />
      <NumberField label="Кількість помилок" name="errorCount" form={form} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("belowThreshold")} /> Нижче порогового</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("partial")} /> Частковий тест</label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...form.register("countsTowardAverage")} /> Враховувати в середньому рейтинговому балі. Лише для повного результату з відомим рейтингом.</label>
      <Field label="Коментар" className="sm:col-span-2"><Textarea {...form.register("comment")} /></Field>
      {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2"><Button type="submit">Зберегти результат</Button></div>
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

export function QuestionForm({ topics }: { topics: { id: string; title: string; subjectId: string }[] }) {
  const [message, setMessage] = useState("");
  return (
    <form className="grid gap-3" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const lines = String(form.get("options") ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
      const options = lines.map((line) => {
        const [label, text, matchKey] = line.split("|");
        return { label: label.trim(), text: (text ?? "").trim(), matchKey: matchKey?.trim() || undefined };
      });
      const result = await saveQuestion({
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
      setMessage(result.ok ? "Завдання збережено." : result.error);
      if (result.ok) event.currentTarget.reset();
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Предмет"><SubjectSelect /></Field>
        <Field label="Тема">
          <select name="topicId" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </Field>
        <Field label="Тип">
          <select name="type" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
            <option value="SINGLE_CHOICE">Одна відповідь</option>
            <option value="MATCHING">Відповідність</option>
            <option value="SEQUENCE">Послідовність</option>
            <option value="NUMERIC">Число</option>
            <option value="SHORT_TEXT">Короткий текст</option>
            <option value="STEP_BY_STEP">Покрокова задача</option>
          </select>
        </Field>
        <Field label="Складність">
          <select name="difficulty" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm">
            <option value="EASY">Просте</option>
            <option value="MEDIUM">Середнє</option>
            <option value="HARD">Складне</option>
          </select>
        </Field>
      </div>
      <Field label="Умова"><Textarea name="prompt" required /></Field>
      <Field label="Пояснення"><Textarea name="explanation" required /></Field>
      <Field label="Правильна відповідь"><Input name="correctAnswer" required placeholder="id варіанта, число, текст або JSON" /></Field>
      <Field label="Варіанти, по одному в рядку: мітка|текст|left або right"><Textarea name="options" /></Field>
      <Field label="Джерело"><Input name="source" placeholder="Не пишіть «офіційне», якщо це не так" /></Field>
      <input type="hidden" name="subtopic" value="" />
      <Field label="Статус">
        <select name="verificationStatus" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" defaultValue="DRAFT">
          <option value="DRAFT">Чернетка</option>
          <option value="PENDING_REVIEW">Очікує перевірки</option>
          <option value="VERIFIED">Перевірено</option>
          <option value="REJECTED">Відхилено</option>
        </select>
      </Field>
      <Button type="submit">Зберегти завдання</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function ImportQuestionsForm() {
  const [message, setMessage] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      const result = await importQuestions(String(new FormData(event.currentTarget).get("json") ?? ""));
      setMessage(result.ok ? result.message ?? "Імпортовано." : result.error);
    }}>
      <Textarea name="json" placeholder='[{"subjectId":"math","topicId":"math-linear-eq","type":"NUMERIC","difficulty":"EASY","prompt":"...","explanation":"...","correctAnswer":"1","verificationStatus":"PENDING_REVIEW","options":[]}]' />
      <Button type="submit" variant="outline">Імпортувати JSON</Button>
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
        const form = new FormData(event.currentTarget);
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
        const form = new FormData(event.currentTarget);
        const result = await createTopic({ subjectId: topic.subjectId, parentId: topic.id, title: String(form.get("title") ?? ""), summary: String(form.get("summary") ?? "") });
        setMessage(result.ok ? "Підтему створено." : result.error);
        if (result.ok) event.currentTarget.reset();
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
        const result = await startTopicTest(topicId);
        if (result && !result.ok) setMessage(result.error);
      }}>
        <Button type="submit" disabled={!hasQuestions}>Пройти тест</Button>
      </form>
      {!hasQuestions ? <p className="text-sm text-muted-foreground">Перевірених завдань ще немає.</p> : null}
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}

export function ExamStartForm() {
  const [message, setMessage] = useState("");
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await startExam({
        subjectId: String(form.get("subjectId")),
        title: String(form.get("title") ?? ""),
        count: Number(form.get("count") ?? 12),
        minutes: form.get("minutes") ? Number(form.get("minutes")) : null,
      });
      if (result && !result.ok) setMessage(result.error);
    }}>
      <Field label="Предмет"><SubjectSelect /></Field>
      <Field label="Назва"><Input name="title" placeholder="Мій пробник" /></Field>
      <Field label="Скільки завдань взяти з банку"><Input name="count" type="number" min={1} max={60} defaultValue={12} /></Field>
      <Field label="Ліміт часу, хв"><Input name="minutes" type="number" min={1} placeholder="Необов'язково" /></Field>
      <p className="text-sm text-muted-foreground sm:col-span-2">Формат НМТ-2027 у конфігурації не підтверджено. Пробник бере лише перевірені завдання з банку і не переводить їх у рейтинговий бал.</p>
      <Button type="submit">Почати пробник</Button>
      {message ? <p className="text-sm text-destructive sm:col-span-2">{message}</p> : null}
    </form>
  );
}

const preferenceFormSchema = preferencesSchema;
type PreferenceValues = z.infer<typeof preferenceFormSchema>;

export function SettingsForm({ values, scheduleJson, formatJson, secrets }: { values: PreferenceValues; scheduleJson: string; formatJson: string; secrets: { openai: boolean; gemini: boolean; youtube: boolean; ollama: string } }) {
  const form = useForm<PreferenceValues>({ resolver: zodResolver(preferenceFormSchema), defaultValues: values });
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-8">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (data) => {
        const result = await savePreferences(data);
        setMessage(result.ok ? result.message ?? "Збережено." : result.error);
      })}>
        <Field label="Тема">
          <select className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" {...form.register("theme")}>
            <option value="system">Системна</option>
            <option value="light">Світла</option>
            <option value="dark">Темна</option>
          </select>
        </Field>
        <Field label="Дата НМТ"><Input type="date" {...form.register("examDate")} /></Field>
        <Field label="Цільовий бал"><Input type="number" {...form.register("targetScore", { valueAsNumber: true })} /></Field>
        <Field label="Поріг засвоєння, правильних із 12"><Input type="number" {...form.register("masteryHighMin", { valueAsNumber: true })} /></Field>
        <Field label="Поріг закріплення"><Input type="number" {...form.register("masteryMidMin", { valueAsNumber: true })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("timerEnabled")} /> Показувати таймер у тестах</label>
        <Field label="AI-провайдер">
          <select className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" {...form.register("aiProvider")}>
            <option value="none">Без AI</option>
            <option value="openai">OpenAI API</option>
            <option value="gemini">Gemini API</option>
            <option value="ollama">Ollama</option>
          </select>
        </Field>
        <Field label="Модель"><Input {...form.register("aiModel")} placeholder="gpt-4o-mini, gemini-2.0-flash або llama3.1" /></Field>
        <Field label="Математика, %"><Input type="number" {...form.register("mathPriority", { valueAsNumber: true })} /></Field>
        <Field label="Українська мова, %"><Input type="number" {...form.register("ukrainianPriority", { valueAsNumber: true })} /></Field>
        <Field label="Історія України, %"><Input type="number" {...form.register("historyPriority", { valueAsNumber: true })} /></Field>
        <Field label="Біологія, %"><Input type="number" {...form.register("biologyPriority", { valueAsNumber: true })} /></Field>
        <div className="sm:col-span-2"><Button type="submit">Зберегти налаштування</Button></div>
      </form>
      <JsonSaver title="Розклад" initial={scheduleJson} action={saveSchedule} />
      <JsonSaver title="Формат НМТ і таблиці" initial={formatJson} action={saveFormat} />
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const result = await saveSecretSettings({
          openaiApiKey: String(formData.get("openai") ?? ""),
          geminiApiKey: String(formData.get("gemini") ?? ""),
          youtubeApiKey: String(formData.get("youtube") ?? ""),
          ollamaBaseUrl: String(formData.get("ollama") ?? ""),
          clearOpenai: formData.get("clearOpenai") === "on",
          clearGemini: formData.get("clearGemini") === "on",
          clearYoutube: formData.get("clearYoutube") === "on",
        });
        setMessage(result.ok ? result.message ?? "Ключі збережено." : result.error);
        event.currentTarget.reset();
      }}>
        <h2 className="font-medium">Ключі API</h2>
        <p className="text-sm text-muted-foreground">Порожнє поле не змінює збережений ключ. Поточний стан: OpenAI {secrets.openai ? "є" : "немає"}, Gemini {secrets.gemini ? "є" : "немає"}, YouTube {secrets.youtube ? "є" : "немає"}. Ключі не повертаються в браузер.</p>
        <Input name="openai" type="password" placeholder="Новий ключ OpenAI" autoComplete="off" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clearOpenai" /> Очистити ключ OpenAI</label>
        <Input name="gemini" type="password" placeholder="Новий ключ Gemini" autoComplete="off" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clearGemini" /> Очистити ключ Gemini</label>
        <Input name="youtube" type="password" placeholder="YouTube Data API" autoComplete="off" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clearYoutube" /> Очистити ключ YouTube</label>
        <Input name="ollama" placeholder={secrets.ollama} defaultValue={secrets.ollama} />
        <Button type="submit" variant="outline">Зберегти ключі на сервері</Button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
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

export function NoteForm({ topics }: { topics: { id: string; title: string; subjectId: string }[] }) {
  const [message, setMessage] = useState("");
  return (
    <form className="grid gap-2" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const topic = topics.find((item) => item.id === String(form.get("topicId")));
      const result = await saveNote({ title: String(form.get("title") ?? ""), content: String(form.get("content") ?? ""), topicId: topic?.id, subjectId: topic?.subjectId });
      setMessage(result.ok ? "Конспект збережено." : result.error);
      if (result.ok) event.currentTarget.reset();
    }}>
      <Input name="title" placeholder="Заголовок" required />
      <select name="topicId" className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
        <option value="">Без теми</option>
        {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
      </select>
      <Textarea name="content" required />
      <Button type="submit">Додати конспект</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function StudyLogForm({ subjectId, topicId }: { subjectId?: string; topicId?: string }) {
  const [message, setMessage] = useState("");
  return (
    <form className="flex flex-wrap gap-2" onSubmit={async (event) => {
      event.preventDefault();
      const minutes = Number(new FormData(event.currentTarget).get("minutes"));
      const result = await logStudyMinutes({ subjectId, topicId, minutes });
      setMessage(result.ok ? "Час записано." : result.error);
    }}>
      <Input name="minutes" type="number" min={1} placeholder="Хвилини" className="w-32" required />
      <Button type="submit" variant="outline">Записати час</Button>
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
    </form>
  );
}

export function CustomTaskForm({ dateKey }: { dateKey: string }) {
  const [message, setMessage] = useState("");
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_140px_auto]" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await createCustomTask({ dateKey: String(form.get("date") || dateKey), title: String(form.get("title") ?? ""), durationMin: Number(form.get("minutes") ?? 30), subjectId: String(form.get("subjectId") || "") || undefined });
      setMessage(result.ok ? "Заняття додано." : result.error);
    }}>
      <Input name="title" placeholder="Власне заняття" required />
      <Input name="minutes" type="number" min={0} defaultValue={30} />
      <input type="date" name="date" defaultValue={dateKey} className="h-10 rounded-lg border border-border bg-card px-3 text-sm" />
      <SubjectSelect optional />
      <Button type="submit">Додати</Button>
      {message ? <p className="text-sm text-muted-foreground sm:col-span-3">{message}</p> : null}
    </form>
  );
}

export function TutorForm({ topics }: { topics: { id: string; title: string; subjectId: string }[] }) {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [drafts, setDrafts] = useState<unknown>(null);
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  return (
    <div className="space-y-4">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const topic = topics.find((item) => item.id === String(form.get("topicId")));
        const result = await askTutor({ mode: String(form.get("mode")), subjectId: topic?.subjectId, topicId: topic?.id, prompt: String(form.get("prompt") ?? "") });
        if (!result.ok) {
          setMessage(result.error);
          setAnswer("");
          return;
        }
        setAnswer(result.text);
        setDrafts(result.drafts);
        setMessage(result.warning ?? "");
        setTopicId(topic?.id ?? "");
      }}>
        <select name="mode" className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
          <option value="explain">Поясни тему</option>
          <option value="homework">Дай домашнє завдання</option>
          <option value="check">Перевір мої відповіді</option>
          <option value="mistake">Поясни мою помилку</option>
          <option value="mini">Проведи мінііспит</option>
          <option value="weak">Повтори слабкі теми</option>
        </select>
        <select name="topicId" className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
          {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
        </select>
        <Textarea name="prompt" required placeholder="Що пояснити, які відповіді перевірити або яку помилку розібрати" />
        <Button type="submit">Запитати</Button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {answer ? <div className="whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">{answer}</div> : null}
      {drafts ? <Button type="button" variant="outline" onClick={async () => {
        const topic = topics.find((item) => item.id === topicId);
        if (!topic) return;
        const result = await saveGeneratedQuestions(drafts, topic.subjectId, topic.id);
        setMessage(result.ok ? result.message ?? "Збережено." : result.error);
      }}>Зберегти як чернетку, не в перевірений банк</Button> : null}
    </div>
  );
}

export function BackupRestoreForm() {
  const [message, setMessage] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
      if (!file) return;
      const confirmation = String(new FormData(event.currentTarget).get("confirmation") ?? "");
      if (confirmation !== "ВІДНОВИТИ") {
        setMessage("Введіть ВІДНОВИТИ, щоб замінити поточні дані.");
        return;
      }
      const { restoreBackup } = await import("@/server/actions");
      const result = await restoreBackup(await file.text(), confirmation);
      setMessage(result.ok ? result.message ?? "Відновлено." : result.error);
    }}>
      <Input name="file" type="file" accept="application/json" />
      <Input name="confirmation" placeholder="Введіть ВІДНОВИТИ" autoComplete="off" />
      <Button type="submit" variant="destructive">Відновити з копії</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

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
      <Label>{label}</Label>
      {children}
    </label>
  );
}
