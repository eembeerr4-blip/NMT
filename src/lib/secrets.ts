import fs from "fs";
import path from "path";

export type Secrets = {
  openaiApiKey?: string;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
  youtubeApiKey?: string;
};

const file = path.join(process.cwd(), "data", "secrets.json");

export function readSecrets(): Secrets {
  const fromFile = readFile();
  return {
    openaiApiKey: process.env.OPENAI_API_KEY || fromFile.openaiApiKey || "",
    geminiApiKey: process.env.GEMINI_API_KEY || fromFile.geminiApiKey || "",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || fromFile.ollamaBaseUrl || "http://127.0.0.1:11434",
    youtubeApiKey: process.env.YOUTUBE_API_KEY || fromFile.youtubeApiKey || "",
  };
}

export function writeSecrets(next: Secrets) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const current = readFile();
  const merged: Secrets = {
    openaiApiKey: next.openaiApiKey === undefined ? current.openaiApiKey : next.openaiApiKey,
    geminiApiKey: next.geminiApiKey === undefined ? current.geminiApiKey : next.geminiApiKey,
    ollamaBaseUrl: next.ollamaBaseUrl || current.ollamaBaseUrl || "http://127.0.0.1:11434",
    youtubeApiKey: next.youtubeApiKey === undefined ? current.youtubeApiKey : next.youtubeApiKey,
  };
  fs.writeFileSync(file, JSON.stringify(merged, null, 2), "utf8");
}

function readFile(): Secrets {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Secrets;
  } catch {
    return {};
  }
}
