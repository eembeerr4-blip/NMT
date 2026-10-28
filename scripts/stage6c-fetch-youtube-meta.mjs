import { writeFileSync } from "node:fs";

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("Usage: node stage6c-fetch-youtube-meta.mjs <id>...");
  process.exit(1);
}

function extractPlayer(html) {
  const marker = "ytInitialPlayerResponse = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const slice = html.slice(start + marker.length);
  let depth = 0;
  for (let i = 0; i < slice.length; i += 1) {
    const ch = slice[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(slice.slice(0, i + 1));
      }
    }
  }
  return null;
}

async function inspect(id) {
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const out = { youtubeId: id, watchUrl, errors: [] };
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
    );
    if (oembed.ok) {
      const data = await oembed.json();
      out.oembed = {
        title: data.title,
        author_name: data.author_name,
        author_url: data.author_url,
        thumbnail_url: data.thumbnail_url,
      };
    } else {
      out.errors.push(`oembed HTTP ${oembed.status}`);
    }
  } catch (error) {
    out.errors.push(`oembed ${error.message}`);
  }

  try {
    const embed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/embed/${id}`)}&format=json`);
    out.embedOembedOk = embed.ok;
  } catch (error) {
    out.embedOembedOk = false;
    out.errors.push(`embed oembed ${error.message}`);
  }

  try {
    const page = await fetch(watchUrl, {
      headers: {
        "Accept-Language": "uk,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    out.watchHttp = page.status;
    if (!page.ok) {
      out.errors.push(`watch HTTP ${page.status}`);
    } else {
      const html = await page.text();
      out.playabilityStatus = html.includes('"playabilityStatus"') ? "present" : "missing";
      const player = extractPlayer(html);
      if (!player) {
        out.errors.push("player JSON not parsed");
      } else {
        const details = player.videoDetails ?? {};
        const micro = player.microformat?.playerMicroformatRenderer ?? {};
        const captions = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
        const status = player.playabilityStatus ?? {};
        out.videoDetails = {
          title: details.title ?? null,
          lengthSeconds: details.lengthSeconds ?? null,
          isLiveContent: details.isLiveContent ?? null,
          channelId: details.channelId ?? null,
          shortDescription: (micro.description?.simpleText ?? details.shortDescription ?? "").slice(0, 500),
        };
        out.playability = {
          status: status.status ?? null,
          reason: status.reason ?? null,
          embeddable: player.embeddedPlayerOverlay?.embedHtml ? true : status.playableInEmbed ?? null,
          playableInEmbed: status.playableInEmbed ?? null,
        };
        out.captionTracks = captions.map((track) => ({
          languageCode: track.languageCode,
          name: track.name?.simpleText ?? null,
          vssId: track.vssId ?? null,
        }));
        const ukTrack = captions.find((track) => track.languageCode?.startsWith("uk"));
        if (ukTrack?.baseUrl) {
          try {
            const vtt = await fetch(ukTrack.baseUrl + "&fmt=vtt");
            const text = vtt.ok ? await vtt.text() : "";
            out.transcript = {
              languageCode: ukTrack.languageCode,
              bytes: text.length,
              sample: text.replace(/\s+/g, " ").slice(0, 1200),
            };
          } catch (error) {
            out.errors.push(`caption fetch ${error.message}`);
          }
        } else {
          const auto = captions.find((track) => track.languageCode?.startsWith("en"));
          if (auto?.baseUrl) {
            try {
              const vtt = await fetch(auto.baseUrl + "&fmt=vtt");
              const text = vtt.ok ? await vtt.text() : "";
              out.transcript = {
                languageCode: auto.languageCode,
                bytes: text.length,
                sample: text.replace(/\s+/g, " ").slice(0, 1200),
                note: "no uk captions; auto/other used for partial check only",
              };
            } catch (error) {
              out.errors.push(`caption fetch ${error.message}`);
            }
          }
        }
      }
    }
  } catch (error) {
    out.errors.push(`watch ${error.message}`);
  }

  return out;
}

const results = [];
for (const id of ids) {
  results.push(await inspect(id));
  console.error("done", id);
}
process.stdout.write(JSON.stringify(results, null, 2));
