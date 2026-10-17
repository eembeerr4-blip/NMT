export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
      const id = marker >= 0 ? parts[marker + 1] : undefined;
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export type YoutubeHit = { youtubeId: string; title: string; url: string; channel: string };

export async function searchYouTube(query: string, apiKey?: string): Promise<{ ok: true; items: YoutubeHit[] } | { ok: false; reason: string; searchUrl: string }> {
  const searchUrl = youtubeSearchUrl(query);
  if (!apiKey) return { ok: false, reason: "Автоматичний пошук YouTube зараз недоступний: немає ключа YouTube Data API.", searchUrl };
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "6");
  url.searchParams.set("q", query);
  url.searchParams.set("relevanceLanguage", "uk");
  url.searchParams.set("key", apiKey);
  const response = await fetch(url);
  if (!response.ok) return { ok: false, reason: `YouTube API відповів помилкою ${response.status}.`, searchUrl };
  const data = (await response.json()) as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[] };
  const items = (data.items ?? [])
    .map((item) => {
      const youtubeId = item.id?.videoId ?? "";
      if (!/^[\w-]{11}$/.test(youtubeId)) return null;
      return { youtubeId, title: item.snippet?.title || "Відео YouTube", url: youtubeWatchUrl(youtubeId), channel: item.snippet?.channelTitle || "" };
    })
    .filter((item): item is YoutubeHit => Boolean(item));
  return { ok: true, items };
}
