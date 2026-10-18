import { z } from "zod";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export type AIConfig = {
  provider: "openai" | "gemini" | "ollama" | "none";
  model: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
  signal?: AbortSignal;
};

const questionSchema = z.object({
  type: z.enum(["SINGLE_CHOICE", "MATCHING", "SEQUENCE", "NUMERIC", "SHORT_TEXT", "STEP_BY_STEP"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  prompt: z.string().min(5),
  explanation: z.string().min(5),
  correctAnswer: z.string().min(1),
  options: z.array(z.object({ label: z.string(), text: z.string(), matchKey: z.string().optional() })).default([]),
});

export const aiPackSchema = z.object({
  questions: z.array(questionSchema).length(12),
});

export type AIQuestionDraft = z.infer<typeof questionSchema>;

export async function completeAI(config: AIConfig, messages: AIMessage[]) {
  if (config.provider === "none") {
    throw new Error("AI не налаштовано. Оберіть провайдера в налаштуваннях. Навчання без AI працює.");
  }
  if (config.provider === "openai") {
    if (!config.openaiApiKey) throw new Error("Немає ключа OpenAI на сервері. Підписка ChatGPT не замінює окремий API-ключ.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: config.signal ?? AbortSignal.timeout(120000),
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: config.model || "gpt-4o-mini", messages, temperature: 0.3 }),
    });
    if (!response.ok) throw new Error(`OpenAI відповів помилкою ${response.status}.`);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI повернув порожню відповідь.");
    return text;
  }
  if (config.provider === "gemini") {
    if (!config.geminiApiKey) throw new Error("Немає ключа Gemini на сервері.");
    const model = config.model || "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: messages.find((message) => message.role === "system")?.content ?? "" }] },
          contents: messages
            .filter((message) => message.role !== "system")
            .map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini відповів помилкою ${response.status}.`);
    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini повернув порожню відповідь.");
    return text;
  }
  const base = (config.ollamaBaseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model || "qwen3:4b", messages: messages.map((message, index) => index === messages.length - 1 && (config.model || "qwen3:4b").startsWith("qwen3") ? { ...message, content: `${message.content}\n/no_think` } : message), stream: false, think: false, options: { num_predict: 2048, temperature: 0.3 } }),
    signal: config.signal ?? AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Ollama недоступна (${response.status}). Перевірте, що локальний сервер запущено.`);
  const data = (await response.json()) as { message?: { content?: string }; done_reason?: string };
  if (data.done_reason === "length") throw new Error("Локальна модель не завершила відповідь. Спробуйте коротше запитання; чернетку не показано.");
  const text = stripThinking(data.message?.content ?? "");
  if (!text) throw new Error("Ollama повернула порожню відповідь.");
  return text;
}

export function stripThinking(text: string) {
  const cleaned = text.includes("</think>") ? text.split("</think>").pop() ?? "" : text;
  return cleaned.replace(/<think>[\s\S]*$/i, "").trim();
}

export async function probeOllama(baseUrl = "http://127.0.0.1:11434") {
  const base = baseUrl.replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { ok: false as const, models: [] as string[], reason: `Ollama відповіла ${response.status}.` };
    const data = (await response.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((model) => model.name);
    const preferred = models.find((name) => name.startsWith("qwen3:4b")) ?? models[0] ?? "";
    return { ok: models.length > 0, models, preferred, reason: models.length ? "" : "Ollama запущена, але моделей немає." };
  } catch {
    return { ok: false as const, models: [] as string[], preferred: "", reason: "Ollama зараз не запущена." };
  }
}

export function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]+?)```/i)?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0];
  if (!fenced) throw new Error("Модель не повернула JSON.");
  return JSON.parse(fenced) as unknown;
}
