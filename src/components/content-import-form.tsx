"use client";

import { useRef, useState } from "react";
import type { ContentPackageReport } from "@/lib/content-package";
import { importContentPackage, previewContentPackage } from "@/server/content-import";
import { Button, Card } from "./ui";

const topicLabel: Record<string, string> = {
  create: "Нова",
  fill: "Порожню тему буде заповнено",
  "update-draft": "Чернетку буде оновлено",
  "skip-protected": "Уже існує, не змінюється",
  rejected: "Відхилено",
};

export function ContentImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [payload, setPayload] = useState("");
  const [report, setReport] = useState<ContentPackageReport | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"preview" | "import" | "">("");

  async function readFile(file: File) {
    if (file.size > 2_000_000) throw new Error("Файл завеликий. Максимум 2 МБ.");
    return file.text();
  }

  return <div className="space-y-4">
    <Card className="space-y-3 p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Файл пакета</h2>
      <p className="text-sm text-muted-foreground">Оберіть JSON формату nmt-content-package. Перевірка не записує дані. Імпорт відбудеться лише після окремого підтвердження і збереже матеріали чернетками.</p>
      <label className="grid gap-1.5 text-sm"><span className="font-medium">JSON-файл</span>
        <input ref={fileRef} type="file" accept="application/json,.json" className="text-sm" onChange={(event) => {
          const file = event.target.files?.[0];
          setFileName(file?.name ?? "");
          setPayload("");
          setReport(null);
          setMessage("");
          setError("");
        }} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending !== "" || !fileName} onClick={async () => {
          const file = fileRef.current?.files?.[0];
          if (!file) { setError("Спочатку оберіть файл."); return; }
          setPending("preview"); setError(""); setMessage("");
          try {
            const text = await readFile(file);
            const result = await previewContentPackage(text);
            setPayload(text);
            setReport(result.report ?? null);
            if (result.ok) setMessage(result.message);
            else setError(result.error);
          } catch (cause) {
            setReport(null); setPayload("");
            setError(cause instanceof Error ? cause.message : "Не вдалося прочитати файл.");
          } finally { setPending(""); }
        }}>{pending === "preview" ? "Перевірка…" : "Перевірити пакет"}</Button>
        <Button type="button" disabled={pending !== "" || !report?.ok || !payload} onClick={async () => {
          setPending("import"); setError("");
          try {
            const result = await importContentPackage(payload);
            setReport(result.report ?? report);
            if (result.ok) setMessage(result.message);
            else setError(result.error);
          } finally { setPending(""); }
        }}>{pending === "import" ? "Імпорт…" : "Імпортувати як чернетки"}</Button>
      </div>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
    </Card>
    {report ? <PackagePreview report={report} /> : null}
  </div>;
}

function PackagePreview({ report }: { report: ContentPackageReport }) {
  return <Card className="space-y-4 p-4 sm:p-5">
    <div>
      <h2 className="text-lg font-semibold">Попередній перегляд</h2>
      <p className="text-sm text-muted-foreground">{report.subjectName || "Предмет не визначено"} · розділів {report.sections.length} · тем {report.topics.length} · завдань {report.questionCount} · відео до додавання {report.counts.videosToAdd}</p>
    </div>
    {report.errors.length ? <div role="alert"><h3 className="font-medium">Помилки</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{report.errors.map((issue, index) => <li key={index}>{issue.path ? `${issue.path}: ` : ""}{issue.message}</li>)}</ul></div> : null}
    {report.warnings.length ? <div><h3 className="font-medium">Попередження</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{report.warnings.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></div> : null}
    {report.sections.length ? <div><h3 className="font-medium">Розділи</h3><ul className="mt-1 space-y-1 text-sm">{report.sections.map((section) => <li key={section.code}>{section.title} · {section.disposition === "create" ? "Новий" : "Уже є"}</li>)}</ul></div> : null}
    {report.topics.length ? <div><h3 className="font-medium">Теми</h3><ul className="mt-1 space-y-1 text-sm">{report.topics.map((topic) => <li key={topic.code}>{topic.title} · {topicLabel[topic.disposition] ?? topic.disposition} · завдань {topic.questions}</li>)}</ul></div> : null}
    <p className="text-sm text-muted-foreground">Буде створено тем: {report.counts.topicsToCreate}. Оновлено чернеток: {report.counts.topicsToUpdate}. Пропущено тем: {report.counts.topicsSkipped}. Завдань створено: {report.counts.questionsToCreate}. Завдань пропущено: {report.counts.questionsSkipped}.</p>
  </Card>;
}
