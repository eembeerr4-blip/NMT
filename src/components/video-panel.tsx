"use client";

import { useEffect, useState } from "react";
import { VIDEO_ROLES } from "@/lib/constants";
import { addVideo, deleteVideo, makePrimary, saveVideoNotes, saveVideoPosition, searchYouTube, setVideoReview, setVideoRole, updateVideo } from "@/server/actions";
import { youtubeWatchUrl } from "@/lib/youtube";
import { Button, Card, Input } from "@/components/ui";

type Video = { id: string; youtubeId: string; url: string; title: string; isPrimary: boolean; durationSec: number | null; lastPositionSec: number; notes: string; role?: string; channel?: string; reviewStatus?: string };

export function VideoPanel({ topicId, topicTitle, videos }: { topicId: string; topicTitle: string; videos: Video[] }) {
  const visible = videos.filter((video) => video.reviewStatus !== "REJECTED");
  const confirmed = visible.filter((video) => (video.reviewStatus ?? "CONFIRMED") !== "SUGGESTED");
  const [currentId, setCurrentId] = useState((confirmed.find((video) => video.isPrimary) ?? confirmed[0] ?? visible[0])?.id ?? "");
  const primary = visible.find((video) => video.id === currentId) ?? confirmed[0] ?? visible[0];
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);

  async function onAdd(formData: FormData) {
    const result = await addVideo(topicId, String(formData.get("url") ?? ""), String(formData.get("title") ?? ""));
    setMessage(result.ok ? "Відео додано." : result.error);
  }
  async function onSearch(formData: FormData) {
    const result = await searchYouTube(`${topicTitle} ${String(formData.get("query") ?? "")}`.trim(), topicId);
    if (!result.ok) {
      setMessage(`${result.error}${result.searchUrl ? ` Пошук: ${result.searchUrl}` : ""}`);
      setResults([]);
      return;
    }
    setResults(result.items);
    setMessage(result.items.length ? "Оберіть відео зі списку." : "YouTube не повернув результатів.");
  }

  return (
    <div className="space-y-4">
      {primary ? (
        <Card className="overflow-hidden">
          {playing ? (
            <YouTubeFrame video={primary} />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-muted px-4 text-center">
              <p className="text-sm">Плеєр завантажується лише після запуску.</p>
              <Button type="button" onClick={() => setPlaying(true)}>Запустити лекцію</Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <div className="font-medium">{primary.title || "Лекція YouTube"}</div>
              <div className="text-sm text-muted-foreground">
                {primary.durationSec ? `Тривалість ${Math.round(primary.durationSec / 60)} хв` : "Тривалість з'явиться після запуску, якщо її віддасть плеєр."}
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
          <h2 className="font-medium">Відео ще не додано</h2>
          <p className="mt-1 text-sm text-muted-foreground">Сайт не підставляє випадкові ролики. Додайте посилання, яке ви перевірили.</p>
        </Card>
      )}
      <Card className="space-y-3 p-4">
        <h2 className="font-medium">Додати або замінити відео</h2>
        <form action={onAdd} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <Input name="url" placeholder="Посилання YouTube" required />
          <Input name="title" placeholder="Назва для себе" />
          <Button type="submit">Додати відео</Button>
        </form>
        <form action={onSearch} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input name="query" placeholder="Пошуковий запит для YouTube Data API" />
          <Button type="submit" variant="outline">Шукати</Button>
        </form>
        {results.length ? (
          <div className="space-y-2">
            {results.map((item) => (
              <form key={item.id} action={async () => { const result = await addVideo(topicId, item.id, item.title); setMessage(result.ok ? "Відео додано з пошуку." : result.error); }} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                <span className="text-sm">{item.title}</span>
                <Button type="submit" size="sm" variant="outline">Додати</Button>
              </form>
            ))}
          </div>
        ) : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </Card>
      {videos.length ? (
        <div className="space-y-3">
          {videos.map((video) => (
            <VideoRow key={video.id} video={video} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VideoRow({ video }: { video: Video }) {
  const [notes, setNotes] = useState(video.notes);
  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{video.title || video.youtubeId} {video.isPrimary ? "· основна" : ""}</div>
        <div className="flex gap-2">
          {!video.isPrimary ? <Button type="button" size="sm" variant="outline" onClick={() => void makePrimary(video.id)}>Зробити основною</Button> : null}
          {video.reviewStatus === "SUGGESTED" ? <Button type="button" size="sm" variant="outline" onClick={() => void setVideoReview(video.id, "CONFIRMED")}>Підтвердити</Button> : null}
          {video.reviewStatus !== "REJECTED" ? <Button type="button" size="sm" variant="ghost" onClick={() => void setVideoReview(video.id, "REJECTED")}>Відхилити</Button> : null}
          <select className="h-8 rounded-lg border border-border bg-card px-2 text-xs" defaultValue={video.role ?? "primary"} onChange={(event) => void setVideoRole(video.id, event.target.value)}>
            {VIDEO_ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
          </select>
          <Button type="button" size="sm" variant="ghost" onClick={() => void deleteVideo(video.id)}>Видалити</Button>
        </div>
      </div>
      <form action={async (formData) => { await updateVideo(video.id, String(formData.get("url")), String(formData.get("title"))); }} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <Input name="url" defaultValue={video.url} />
        <Input name="title" defaultValue={video.title} />
        <Button type="submit" size="sm" variant="outline">Замінити</Button>
      </form>
      <textarea className="min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Нотатки до лекції" />
      <Button type="button" size="sm" variant="outline" onClick={() => void saveVideoNotes(video.id, notes)}>Зберегти нотатки</Button>
    </Card>
  );
}

function YouTubeFrame({ video }: { video: Video }) {
  useEffect(() => {
    let player: { destroy?: () => void; getCurrentTime?: () => number; getDuration?: () => number } | null = null;
    let timer = 0;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !window.YT?.Player) return;
      player = new window.YT.Player(`yt-${video.id}`, {
        videoId: video.youtubeId,
        playerVars: { start: video.lastPositionSec, rel: 0, modestbranding: 1 },
        events: {
          onReady: (event: { target: { getDuration?: () => number } }) => {
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
        document.body.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      const current = player?.getCurrentTime?.() ?? 0;
      if (current > 1) void saveVideoPosition(video.id, current, player?.getDuration?.());
      player?.destroy?.();
    };
  }, [video.id, video.youtubeId, video.lastPositionSec]);
  return <div className="aspect-video bg-black"><div id={`yt-${video.id}`} className="h-full w-full" /></div>;
}

declare global {
  interface Window {
    YT?: { Player: new (elementId: string, options: unknown) => { destroy?: () => void; getCurrentTime?: () => number; getDuration?: () => number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}
