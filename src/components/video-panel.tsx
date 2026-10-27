"use client";

import {useActionFeedback} from "./use-action-feedback";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { VIDEO_ROLES } from "@/lib/constants";
import { addVideo, deleteVideo, makePrimary, saveVideoNotes, saveVideoPosition, setVideoReview, setVideoRole, updateVideo } from "@/server/actions";
import { youtubeWatchUrl } from "@/lib/youtube";
import { Button, Card, Input } from "@/components/ui";

type Video = { id: string; youtubeId: string; url: string; title: string; isPrimary: boolean; durationSec: number | null; lastPositionSec: number; notes: string; role?: string; channel?: string; reviewStatus?: string };

export function VideoPanel({ topicId, videos, canEdit = false, variant="default" }: { topicId: string; topicTitle?: string; videos: Video[]; canEdit?: boolean; variant?:"default"|"lesson" }) {
  const rows = canEdit ? videos : videos.filter(video => video.reviewStatus === "CONFIRMED");
  const visible = rows.filter((video) => video.reviewStatus !== "REJECTED");
  const confirmed = visible.filter((video) => video.reviewStatus === "CONFIRMED");
  const [currentId, setCurrentId] = useState("");
  const primary = visible.find((video) => video.id === currentId) ?? confirmed.find(video => video.isPrimary) ?? confirmed[0] ?? visible[0];
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");

  async function onAdd(formData: FormData) {
    const result = await addVideo(topicId, String(formData.get("url") ?? ""), String(formData.get("title") ?? ""));
    setMessage(result.ok ? result.message ?? "Відеокандидат додано." : result.error);
  }

  return (
    <div className={variant==="lesson"?"d04-video space-y-4":"space-y-4"}>
      {primary ? (
        <Card className="overflow-hidden">
          {playing ? (
            <YouTubeFrame key={primary.id} video={primary} />
          ) : (
            <div className="relative flex aspect-video flex-col items-center justify-center gap-3 overflow-hidden bg-muted px-4 text-center" style={{backgroundImage:`linear-gradient(rgba(8,15,30,.25),rgba(8,15,30,.8)),url(https://i.ytimg.com/vi/${encodeURIComponent(primary.youtubeId)}/hqdefault.jpg)`,backgroundSize:"cover",backgroundPosition:"center"}}>
              <p className="relative max-w-lg text-sm font-medium text-white">{primary.title||"Відеолекція"}</p>
              <Button type="button" onClick={() => setPlaying(true)}><Play className="h-4 w-4"/>Запустити лекцію</Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <div className="font-medium">{primary.title || "Лекція YouTube"}</div>
              {primary.reviewStatus === "SUGGESTED" ? <p className="text-sm text-muted-foreground">Кандидат: повний перегляд і відтворення ще не підтверджені редактором.</p> : null}
              <div className="text-sm text-muted-foreground">
                {primary.durationSec ? `Тривалість ${Math.round(primary.durationSec / 60)} хв` : "Тривалість ще не вказана редактором."}
                {primary.lastPositionSec > 0 ? ` · Зупинились на ${Math.floor(primary.lastPositionSec / 60)} хв` : ""}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" className="text-sm underline" onClick={() => {
                const pool = confirmed.filter((video) => video.youtubeId !== primary.youtubeId);
                const next = pool[0];
                if (!next) setMessage("Іншого підтвердженого відео для цієї теми ще немає.");
                else { setCurrentId(next.id); setPlaying(false); setMessage(next.role ? `Інше пояснення: ${VIDEO_ROLES.find((role) => role.id === next.role)?.label ?? next.role}.` : "Інше пояснення."); }
              }}>Інше пояснення</button>
              <a className="text-sm underline" href={primary.url || youtubeWatchUrl(primary.youtubeId)} target="_blank" rel="noreferrer">Відкрити оригінал</a>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <h2 className="font-medium">Відео поки не додано</h2>
          <p className="mt-1 text-sm text-muted-foreground">{variant==="lesson"&&!canEdit?"Вивчайте доступну теорію та приклади. Відеопояснення з’явиться після перевірки редактором.":"Сайт не підставляє випадкові ролики. Додайте посилання, яке ви перевірили."}</p>
        </Card>
      )}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {canEdit ? <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-medium">Інструменти редактора відео</summary><Card className="space-y-3 p-4">
        <h2 className="font-medium">Додати відеокандидат</h2>
        <form action={onAdd} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <Input name="url" placeholder="Посилання YouTube" required />
          <Input name="title" placeholder="Назва для себе" />
          <Button type="submit">Додати відео</Button>
        </form>
      </Card></details> : null}
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((video) => (
            <VideoRow key={video.id} video={video} canEdit={canEdit} lessonStyle={variant==="lesson"} onPrimary={() => { setCurrentId(video.id); setPlaying(false); }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VideoRow({ video, canEdit, lessonStyle=false, onPrimary }: { video: Video; canEdit: boolean; lessonStyle?:boolean; onPrimary?: () => void }) {
  const [notes, setNotes] = useState(video.notes);
  const {pending,result,run}=useActionFeedback();
  return (
    <Card className={lessonStyle?"d04f-video-notes space-y-2 p-4":"space-y-2 p-4"}>
      {lessonStyle?<h3>Мої нотатки до відео</h3>:null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{video.title || video.youtubeId} {video.isPrimary && video.reviewStatus === "CONFIRMED" ? "· основна" : ""}{canEdit ? ` · ${video.reviewStatus ?? "SUGGESTED"}` : ""}</div>
        {canEdit ? <div className="flex flex-wrap gap-2">
          {!video.isPrimary && video.reviewStatus === "CONFIRMED" ? <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(()=>makePrimary(video.id), onPrimary)}>Зробити основною</Button> : null}
          {video.reviewStatus === "SUGGESTED" ? <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(()=>setVideoReview(video.id, "CONFIRMED"))}>Підтвердити</Button> : null}
          {video.reviewStatus !== "REJECTED" ? <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(()=>setVideoReview(video.id, "REJECTED"))}>Відхилити</Button> : null}
          <select className="h-8 rounded-lg border border-border bg-card px-2 text-xs" aria-label="Роль відео" disabled={pending} defaultValue={video.role ?? "primary"} onChange={(event) => {const role=event.target.value;void run(()=>setVideoRole(video.id,role));}}>
            {VIDEO_ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
          </select>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => {if(window.confirm("Видалити це відео з теми?"))void run(()=>deleteVideo(video.id));}}>Видалити</Button>
        </div> : null}
      </div>
      {canEdit ? <form action={async (formData) => { await run(()=>updateVideo(video.id, String(formData.get("url")), String(formData.get("title")))); }} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <Input name="url" defaultValue={video.url} />
        <Input name="title" defaultValue={video.title} />
        <Button type="submit" size="sm" variant="outline">Зберегти назву</Button>
      </form> : null}
      {canEdit ? <p className="text-xs text-muted-foreground">Інший ролик додайте окремим кандидатом. Збереження тут змінює лише назву.</p> : null}
      <textarea aria-label="Нотатки до лекції" className="min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Нотатки до лекції" />
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={async () => { await run(()=>saveVideoNotes(video.id,notes)); }}>Зберегти нотатки</Button>
      {result ? <p role={result.ok?"status":"alert"} className="text-sm">{result.ok?result.message??"Зміни збережено.":result.error}</p> : null}
    </Card>
  );
}

function YouTubeFrame({ video }: { video: Video }) {
  const [error, setError] = useState("");
  useEffect(() => {
    let player: { destroy?: () => void; getCurrentTime?: () => number; getDuration?: () => number } | null = null;
    let timer = 0;
    let cancelled = false;
    const loadTimeout = window.setTimeout(() => { if (!cancelled) setError("YouTube не відповів. Спробуйте відкрити оригінал; конспект і практика доступні."); }, 10000);
    const mount = () => {
      if (cancelled || !window.YT?.Player) return;
      player = new window.YT.Player(`yt-${video.id}`, {
        videoId: video.youtubeId,
        playerVars: { start: video.lastPositionSec, rel: 0, origin: window.location.origin },
        events: {
          onError: () => { window.clearTimeout(loadTimeout); setError("Не вдалося відтворити відео. Відкрийте оригінал або оберіть інше пояснення."); },
          onReady: (event: { target: { getDuration?: () => number } }) => {
            window.clearTimeout(loadTimeout);
            setError("");
            const duration = Math.round(event.target.getDuration?.() ?? 0);
            if (duration > 0) void saveVideoPosition(video.id, video.lastPositionSec, duration);
          },
        },
      });
      timer = window.setInterval(() => {
        const current = player?.getCurrentTime?.() ?? 0;
        const duration = player?.getDuration?.() ?? 0;
        if (current > 1) void saveVideoPosition(video.id, current, duration);
      }, 8000);
    };
    if (window.YT?.Player) mount();
    else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        mount();
      };
      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => setError("Не вдалося завантажити керування YouTube. Відкрийте оригінал; конспект і практика доступні.");
        document.body.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(loadTimeout);
      const current = player?.getCurrentTime?.() ?? 0;
      if (current > 1) void saveVideoPosition(video.id, current, player?.getDuration?.());
      player?.destroy?.();
    };
  }, [video.id, video.youtubeId, video.lastPositionSec]);
  return <div>
    <div className="aspect-video bg-black"><iframe id={`yt-${video.id}`} title={video.title || "Відеолекція"} src={`https://www.youtube.com/embed/${encodeURIComponent(video.youtubeId)}?enablejsapi=1&rel=0&start=${video.lastPositionSec}`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
    {error ? <p role="alert" className="p-3 text-sm">{error} <a className="underline" href={video.url || youtubeWatchUrl(video.youtubeId)} target="_blank" rel="noreferrer">Відкрити на YouTube</a></p> : null}
  </div>;
}

declare global {
  interface Window {
    YT?: { Player: new (elementId: string, options: unknown) => { destroy?: () => void; getCurrentTime?: () => number; getDuration?: () => number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}
