"use client";

import { useRef, useState } from "react";
import { completeLesson, enableLocalTutor, searchYouTube } from "@/server/actions";
import { Button } from "@/components/ui";

const quick = [
  { mode: "simpler", label: "Поясни простіше" },
  { mode: "example", label: "Покажи приклад" },
  { mode: "steps", label: "Розбери покроково" },
  { mode: "hint", label: "Дай підказку" },
  { mode: "check", label: "Перевір моє рішення" },
];

export function LessonTutor({ topicId, topicTitle, provider }: { topicId: string; topicTitle: string; provider: string }) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [videoLinks,setVideoLinks] = useState<{title:string;url:string}[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(mode: string, text: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setAnswer("");
    setVideoLinks([]);
    setStatus("");
    try {
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, topicId, prompt: text }),
        signal: controller.signal,
      });
      if (abortRef.current !== controller) return;
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setStatus(data.error ?? "AI зараз недоступний.");
        return;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await response.json()) as { text?: string };
        if (!data.text?.trim()) setStatus("AI повернув порожню відповідь. Спробуйте інший запит.");
        setAnswer(data.text ?? "");
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        full += decoder.decode(chunk.value, { stream: true });
        setAnswer(full);
      }
    } catch (error) {
      if (abortRef.current !== controller) return;
      if ((error as Error).name === "AbortError") setStatus("Запит скасовано.");
      else setStatus("Не вдалося отримати відповідь. Конспект і тест працюють без AI.");
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  }

  async function findVideo() {
    const result = await searchYouTube(`${topicTitle} пояснення українською`, topicId);
    if (!result.ok) {
      setStatus(result.error);
      setAnswer("");
      setVideoLinks(result.searchUrl ? [{title:"Відкрити пошук на YouTube",url:result.searchUrl}] : []);
      return;
    }
    setAnswer("");
    setVideoLinks(result.items.map(item=>({title:item.title,url:"https://www.youtube.com/watch?v="+encodeURIComponent(item.id)})));
    setStatus(result.items.length ? "Знайдені відео потребують перевірки редактором. Можна відкрити оригінал." : "Відео не знайдено. Спробуйте інший запит.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void ask("unclear", prompt || `Я не зрозумів тему «${topicTitle}». Поясни інакше.`)}>Я не зрозумів</Button>
        {quick.map((item) => (
          <Button key={item.mode} type="button" size="sm" disabled={busy} variant="outline" onClick={() => void ask(item.mode, prompt || `${item.label}: ${topicTitle}`)}>{item.label}</Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => void findVideo()}>Знайди інше відео</Button>
      </div>
      <textarea className="min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Що саме незрозуміло або яке рішення перевірити" />
      <div className="flex gap-2">
        <Button type="button" disabled={busy} onClick={() => void ask("explain", prompt || `Поясни тему «${topicTitle}».`)}>Запитати</Button>
        {busy ? <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>Скасувати</Button> : null}
        {provider === "none" ? <Button type="button" variant="outline" onClick={async () => { const result = await enableLocalTutor(); setStatus(result.ok ? result.message ?? "Увімкнено." : result.error); }}>{provider === "none" ? "Увімкнути локальну Ollama" : ""}</Button> : null}
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {videoLinks.map(link=><a key={link.url} className="block text-sm underline" href={link.url} target="_blank" rel="noreferrer">{link.title}</a>)}
      {answer ? <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</div> : null}
    </div>
  );
}

export function CompleteLesson({ topicId, needsPractice }: { topicId: string; needsPractice: boolean }) {
  const [message, setMessage] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      const studied = new FormData(event.currentTarget).get("studied") === "on";
      const result = await completeLesson(topicId, studied);
      setMessage(result.ok ? result.message ?? "Урок зараховано." : result.error);
    }}>
      {needsPractice ? null : <label className="flex items-center gap-2 text-sm"><input name="studied" type="checkbox" /> Я опрацював конспект</label>}
      <Button type="submit">{needsPractice?"Завершити урок":"Позначити конспект як опрацьований"}</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
