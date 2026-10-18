import { completeAI, probeOllama, type AIMessage } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { readSecrets } from "@/lib/secrets";
import { getSessionUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export const dynamic = "force-dynamic";

const modes: Record<string, string> = {
  explain: "Поясни тему простою українською.",
  unclear: "Учень не зрозумів. Назви ймовірний складний крок, поясни іншими словами, дай новий приклад і одне коротке питання для перевірки. Не видавай відповідь на це питання одразу.",
  simpler: "Поясни ще простіше, без нових термінів.",
  example: "Покажи один новий приклад із коротким розв'язанням.",
  steps: "Розбери покроково.",
  hint: "Дай лише одну коротку підказку (1–2 речення) про наступний крок. Не повідомляй кінцеву відповідь і не розв’язуй задачу до кінця.",
  check: "Перевір розв'язання учня. Якщо в умові бракує даних, так і скажи. Не підміняй відповідь здогадкою.",
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Потрібен вхід до профілю." }, { status: 401 });
  let body: { mode?: string; topicId?: string; prompt?: string };
  try { body = await request.json(); if (!body || (body.prompt !== undefined && typeof body.prompt !== "string") || (body.topicId !== undefined && typeof body.topicId !== "string")) throw new Error(); } catch { return Response.json({ error: "Некоректний запит." }, { status: 400 }); }
  const prompt = (body.prompt ?? "").trim();
  if (prompt.length > 6000) return Response.json({ error: "Скоротіть запит до 6000 символів." }, { status: 400 });
  if (prompt.length < 2) return Response.json({ error: "Напишіть, що саме незрозуміло." }, { status: 400 });
  const settings = await getSettings(user.id);
  const provider = settings.aiProvider as "none" | "openai" | "gemini" | "ollama";
  if (provider === "none") {
    return Response.json({ error: "AI-репетитор вимкнено. Конспект, тест і календар працюють без нього." }, { status: 400 });
  }
  const topic = body.topicId ? await prisma.topic.findUnique({ where: { id: body.topicId } }) : null;
  const mode = modes[body.mode ?? "explain"] ?? modes.explain;
  const messages: AIMessage[] = [
    { role: "system", content: "Ти репетитор НМТ. Відповідай українською. Покажи лише готове пояснення для учня, без чернеток і обговорення того, як сформулювати відповідь. Не вигадуй офіційні джерела, номери бланків і таблиці балів. Якщо не певен, скажи про це." },
    { role: "user", content: [mode, topic ? `Тема: ${topic.title}. ${topic.summary}` : "", prompt].filter(Boolean).join("\n") },
  ];
  const secrets = readSecrets();
  if (provider !== "ollama") {
    try {
      const text = await completeAI({ provider, model: settings.aiModel, openaiApiKey: secrets.openaiApiKey, geminiApiKey: secrets.geminiApiKey, signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]) }, messages);
      await save(user.id, body.mode ?? "explain", provider, settings.aiModel, messages, text);
      return Response.json({ text });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Помилка AI." }, { status: 502 });
    }
  }
  const probe = await probeOllama(secrets.ollamaBaseUrl);
  if (!probe.ok) return Response.json({ error: probe.reason }, { status: 503 });
  const model = settings.aiModel || probe.preferred;
  try {
    const text = await completeAI({ provider: "ollama", model, ollamaBaseUrl: secrets.ollamaBaseUrl, signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]) }, messages);
    await save(user.id, body.mode ?? "explain", "ollama", model, messages, text);
    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.name !== "AbortError" ? error.message : "Запит скасовано або час очікування вичерпано. Навчання без AI доступне." }, { status: 503 });
  }
}

async function save(userId: string, mode: string, provider: string, model: string, messages: AIMessage[], text: string) {
  if (!text.trim()) return;
  const conversation = await prisma.aIConversation.create({
    data: { userId, mode, provider, model, messagesJson: JSON.stringify([...messages, { role: "assistant", content: text }]) },
  });
  await prisma.aIMessage.createMany({
    data: [...messages, { role: "assistant" as const, content: text }].map((message) => ({ conversationId: conversation.id, role: message.role, content: message.content })),
  });
}
