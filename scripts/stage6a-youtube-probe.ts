import { writeFileSync } from "node:fs";
import path from "node:path";

const VIDEOS = [
  { topicId: "ukr-lex-01-meaning", youtubeId: "NDmd6xU9F2E" },
  { topicId: "ukr-lex-02-syn-ant-hom", youtubeId: "scigg_eN4qs" },
  { topicId: "ukr-lex-03-phraseology", youtubeId: "oZfA9V0mhV4" },
  { topicId: "bio-cell-01-eukaryotic-cell", youtubeId: "7DtFjdHJvKg" },
  { topicId: "zcode-biology-molecular-dna-rna", youtubeId: "R4USDzLsfNk" },
  { topicId: "zcode-biology-molecular-protein-synth", youtubeId: "ia61JnRXC9o" },
  { topicId: "zcode-biology-molecular-division", youtubeId: "WMtpCLP1B2A" },
];

async function probe(id: string) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    if (!res.ok) return { availability: "HTTP_" + res.status, contentReview: "NOT VERIFIED" };
    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      availability: "EMBED_METADATA_OK",
      oembedTitle: data.title ?? null,
      channel: data.author_name ?? null,
      contentReview: "NOT VERIFIED",
      note: "oEmbed OK ≠ перегляд змісту; embed/playability не підтверджено",
    };
  } catch (e) {
    return { availability: "FETCH_FAILED", error: String(e), contentReview: "NOT VERIFIED" };
  }
}

async function main() {
  const results = [];
  for (const v of VIDEOS) {
    results.push({ ...v, url: `https://www.youtube.com/watch?v=${v.youtubeId}`, ...(await probe(v.youtubeId)) });
  }
  const outDir = process.env.STAGE6A_OUT_DIR ?? path.join(process.cwd(), "stage6a-audit");
  writeFileSync(path.join(outDir, "stage6a-youtube-probe.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map((r) => ({ id: r.youtubeId, availability: r.availability })), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
