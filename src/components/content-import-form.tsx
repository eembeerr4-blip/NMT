"use client";

import { useId, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, CheckCircle2, FileJson, Loader2, ShieldCheck, Upload } from "lucide-react";
import type { ContentPackageReport } from "@/lib/content-package";
import { CONTENT_PACKAGE_LIMITS } from "@/lib/content-package-limits";
import { importContentPackage, previewContentPackage } from "@/server/content-import";
import { Button, Card } from "./ui";

const topicLabel: Record<string, string> = {
  create: "Новий урок", fill: "Порожню тему буде заповнено", "update-draft": "Чернетку буде оновлено",
  "skip-protected": "Наявний матеріал не змінюється", rejected: "Відхилено",
};
const disabledStyle = "disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";

export function ContentImportForm() {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState("");
  const [report, setReport] = useState<ContentPackageReport | null>(null);
  const [verified, setVerified] = useState(false);
  const [imported, setImported] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"preview" | "import" | "">("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileError = file && (!file.name.toLowerCase().endsWith(".json") ? "Оберіть файл із розширенням .json." : file.size > CONTENT_PACKAGE_LIMITS.maxBytes ? "Файл завеликий. Максимум 2 МБ." : "");
  const canImport = verified && report?.ok && !!payload && !imported && !pending;
  const importHint = imported ? "Імпорт завершено. Для повторної операції оберіть інший файл або знову перевірте пакет."
    : !file ? "Спочатку оберіть JSON-файл у кроці 1."
    : !verified ? "Спочатку успішно перевірте пакет у кроці 2."
    : "Перевірте підсумок. Наступна кнопка відкриє підтвердження перед записом.";

  async function preview() {
    if (!file || fileError || lock.current) return;
    lock.current = true;
    setPending("preview"); setVerified(false); setImported(false); setReport(null); setPayload(""); setError(""); setMessage("");
    try {
      const text = await file.text();
      const result = await previewContentPackage(text);
      setReport(result.report ?? null);
      if (result.ok && result.report.ok) { setPayload(text); setVerified(true); setMessage(result.message); }
      else setError(result.ok ? "Пакет містить помилки. Перевірте попередній перегляд." : result.error);
    } catch {
      setError("Не вдалося перевірити файл. Перевірте з’єднання та спробуйте ще раз.");
    } finally { lock.current = false; setPending(""); }
  }

  async function importPackage() {
    if (!canImport || lock.current) return;
    lock.current = true;
    setPending("import"); setError(""); setMessage("");
    try {
      const result = await importContentPackage(payload);
      if (result.report) setReport(result.report);
      if (result.ok) { setImported(true); setMessage(result.message); }
      else setError(result.error);
    } catch {
      setError("Не вдалося отримати результат імпорту. Не повторюйте запис навмання: спочатку перевірте пакет і стан матеріалів.");
    } finally { setVerified(false); lock.current = false; setPending(""); setConfirmOpen(false); }
  }

  return <AlertDialog.Root open={confirmOpen} onOpenChange={(open) => { if (pending !== "import") setConfirmOpen(open); }}>
    <div className="min-w-0 space-y-5">
      <Card className="space-y-4 p-4 sm:p-6" aria-labelledby={`${fileId}-step1`}>
        <h2 id={`${fileId}-step1`} className="text-lg font-semibold">Крок 1. Оберіть файл</h2>
        <div className="flex min-w-0 flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/40 p-5 text-center sm:flex-row sm:text-left">
          <FileJson aria-hidden="true" className="h-12 w-12 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-medium">{file ? <span className="[overflow-wrap:anywhere]">{file.name}</span> : "Навчальний пакет у форматі JSON"}</p>
            <p id={`${fileId}-file-help`} className="text-sm text-muted-foreground">{file ? `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(file.size / 1000)} КБ · ` : ""}.json · максимум 2 МБ</p>
            <label htmlFor={fileId} className="sr-only">JSON-файл</label>
            <input id={fileId} ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-describedby={`${fileId}-file-help`} disabled={!!pending} onChange={(event) => {
              setFile(event.target.files?.[0] ?? null); setPayload(""); setReport(null); setVerified(false); setImported(false); setMessage(""); setError(""); setConfirmOpen(false);
            }} />
            <Button ref={chooseRef} type="button" variant="outline" className={`max-w-full whitespace-normal ${disabledStyle}`} disabled={!!pending} onClick={() => fileRef.current?.click()}><Upload aria-hidden="true" />{file ? "Замінити файл" : "Обрати JSON-файл"}</Button>
          </div>
        </div>
        {fileError ? <p role="alert" className="rounded-xl border border-danger-border bg-danger-surface p-3 text-sm text-danger-text">{fileError}</p> : null}
      </Card>

      <Card className="space-y-4 p-4 sm:p-6" aria-labelledby={`${fileId}-step2`} aria-busy={pending === "preview"}>
        <div><h2 id={`${fileId}-step2`} className="text-lg font-semibold">Крок 2. Перевірте пакет</h2><p id={`${fileId}-preview-help`} className="mt-1 text-sm text-muted-foreground">{!file ? "Кнопка стане доступною після вибору файлу." : "Перевірка покаже склад пакета та можливі конфлікти. Дані ще не записуються."}</p></div>
        <Button type="button" variant="outline" className={disabledStyle} aria-describedby={`${fileId}-preview-help`} disabled={!!pending || !file || !!fileError} onClick={() => void preview()}>{pending === "preview" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}{pending === "preview" ? "Перевіряємо пакет…" : "Перевірити пакет"}</Button>
        {pending === "preview" ? <p role="status" className="text-sm text-muted-foreground">Перевіряємо структуру, уроки та запитання…</p> : null}
        {message && !imported ? <p role="status" className="flex gap-2 rounded-xl border border-border bg-muted p-3 text-sm"><CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />{message}</p> : null}
        {error ? <p role="alert" className="rounded-xl border border-danger-border bg-danger-surface p-3 text-sm text-danger-text">{error}</p> : null}
        {report ? <PackagePreview report={report} /> : null}
      </Card>

      <Card className="space-y-4 p-4 sm:p-6" aria-labelledby={`${fileId}-step3`} aria-busy={pending === "import"}>
        <div><h2 id={`${fileId}-step3`} className="text-lg font-semibold">Крок 3. Імпортуйте матеріали</h2><p className="mt-2 flex items-start gap-2 text-sm"><ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />Чернетки не доступні учням до публікації</p></div>
        <p id={`${fileId}-import-help`} className="text-sm text-muted-foreground">{importHint}</p>
        <AlertDialog.Trigger asChild><Button type="button" className={`max-w-full whitespace-normal ${disabledStyle}`} disabled={!canImport} aria-describedby={`${fileId}-import-help`}>{pending === "import" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}{pending === "import" ? "Імпортуємо…" : "Імпортувати як чернетки"}</Button></AlertDialog.Trigger>
        {imported && message ? <div role="status" className="space-y-2 rounded-xl border border-border bg-muted p-4"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 aria-hidden="true" className="h-5 w-5" />Матеріали імпортовано як чернетки</p><p className="text-sm">{message}</p></div> : null}
      </Card>
    </div>

    <AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" /><AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:p-6" onCloseAutoFocus={(event) => { if (imported || !verified) { event.preventDefault(); chooseRef.current?.focus(); } }} onEscapeKeyDown={(event) => { if (pending === "import") event.preventDefault(); }}>
      <AlertDialog.Title className="text-lg font-semibold">Підтвердьте імпорт</AlertDialog.Title>
      <AlertDialog.Description className="text-sm text-muted-foreground">Пакет буде записано в базу як чернетки. Учні не отримають доступ до матеріалів до окремої публікації.</AlertDialog.Description>
      {report ? <ImportCounts counts={report.counts} /> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending === "import"}>Повернутися</Button></AlertDialog.Cancel><Button type="button" disabled={!canImport} onClick={() => void importPackage()}>{pending === "import" ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}{pending === "import" ? "Імпортуємо…" : "Так, імпортувати чернетки"}</Button></div>
    </AlertDialog.Content></AlertDialog.Portal>
  </AlertDialog.Root>;
}

function ImportCounts({ counts }: { counts: ContentPackageReport["counts"] }) {
  return <dl className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm sm:grid-cols-2">
    <div><dt className="text-muted-foreground">Нові розділи</dt><dd className="font-semibold">{counts.sectionsToCreate}</dd></div>
    <div><dt className="text-muted-foreground">Нові відео</dt><dd className="font-semibold">{counts.videosToAdd}</dd></div>
    <div><dt className="text-muted-foreground">Уроки</dt><dd>Нові: <strong>{counts.topicsToCreate}</strong> · оновлення: <strong>{counts.topicsToUpdate}</strong></dd></div>
    <div><dt className="text-muted-foreground">Запитання</dt><dd>Нові: <strong>{counts.questionsToCreate}</strong> · оновлення: <strong>{counts.questionsToUpdate}</strong></dd></div>
    <div className="sm:col-span-2"><dt className="text-muted-foreground">Буде пропущено без змін</dt><dd>Уроків: {counts.topicsSkipped} · запитань: {counts.questionsSkipped}</dd></div>
  </dl>;
}

function PackagePreview({ report }: { report: ContentPackageReport }) {
  return <div className="min-w-0 space-y-4 border-t border-border pt-4 [overflow-wrap:anywhere]">
    <div><h3 className="font-semibold">Попередній перегляд</h3><p className="mt-1 text-sm text-muted-foreground">{report.subjectName || "Предмет не визначено"} · розділів {report.sections.length} · уроків {report.topics.length} · запитань {report.questionCount}</p></div>
    {report.errors.length ? <div role="alert" className="rounded-xl border border-danger-border bg-danger-surface p-3 text-danger-text"><h4 className="font-semibold">Помилки — імпорт заблоковано</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{report.errors.map((issue, index) => <li key={index}>{issue.path ? `${issue.path}: ` : ""}{issue.message}</li>)}</ul></div> : null}
    {report.warnings.length ? <div className="rounded-xl border border-border bg-muted p-3"><h4 className="flex items-center gap-2 font-semibold"><AlertTriangle aria-hidden="true" className="h-4 w-4" />Попередження</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{report.warnings.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></div> : null}
    <ImportCounts counts={report.counts} />
    {report.sections.length || report.topics.length ? <details className="rounded-xl border border-border p-3" open><summary className="cursor-pointer font-medium">Склад пакета та зміни</summary><div className="mt-3 space-y-4">{report.sections.length ? <div><h4 className="font-medium">Розділи</h4><ul className="mt-1 space-y-2 text-sm">{report.sections.map((section) => <li key={section.code}>{section.title} · {section.disposition === "create" ? "Буде створено" : "Уже існує, без змін"}</li>)}</ul></div> : null}{report.topics.length ? <div><h4 className="font-medium">Уроки</h4><ul className="mt-1 space-y-2 text-sm">{report.topics.map((topic) => <li key={topic.code}>{topic.title} · {topicLabel[topic.disposition] ?? topic.disposition} · запитань {topic.questions}</li>)}</ul></div> : null}</div></details> : null}
  </div>;
}
