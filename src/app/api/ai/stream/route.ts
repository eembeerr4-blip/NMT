import { completeAI, probeOllama, stripThinking, type AIMessage } from "@/lib/ai";
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
  hint: "Дай підказку, але не повідомляй кінцеву відповідь.",
  check: "Перевір розв'язання учня. Якщо в умові бракує даних, так і скажи. Не підміняй відповідь здогадкою.",
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Потрібен вхід до профілю." }, { status: 401 });
  const body = (await request.json()) as { mode?: string; topicId?: string; prompt?: string };
  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 2) return Response.json({ error: "Напишіть, що саме незрозуміло." }, { status: 400 });
  const settings = await getSettings(user.id);
  const provider = settings.aiProvider as "none" | "openai" | "gemini" | "ollama";
  if (provider === "none") {
    return Response.json({ error: "AI-репетитор вимкнено. Конспект, тест і календар працюють без нього." }, { status: 400 });
  }
  const topic = body.topicId ? await prisma.topic.findUnique({ where: { id: body.topicId } }) : null;
  const mode = modes[body.mode ?? "explain"] ?? modes.explain;
  const messages: AIMessage[] = [
    { role: "system", content: "Ти репетитор НМТ. Відповідай українською. Не вигадуй офіційні джерела, номери бланків і таблиці балів. Якщо не певен, скажи про це." },
    { role: "user", content: [mode, topic ? `Тема: ${topic.title}. ${topic.summary}` : "", prompt].filter(Boolean).join("\n") },
  ];
  const secrets = readSecrets();
  if (provider !== "ollama") {
    try {
      const text = await completeAI({ provider, model: settings.aiModel, openaiApiKey: secrets.openaiApiKey, geminiApiKey: secrets.geminiApiKey }, messages);
      await save(user.id, body.mode ?? "explain", provider, settings.aiModel, messages, text);
      return Response.json({ text });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Помилка AI." }, { status: 502 });
    }
  }
  const probe = await probeOllama(secrets.ollamaBaseUrl);
  if (!probe.ok) return Response.json({ error: probe.reason }, { status: 503 });
  const model = settings.aiModel || probe.preferred;
  const base = (secrets.ollamaBaseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
  const upstream = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, think: false }),
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return Response.json({ error: "Ollama не відповіла. Навчання без AI доступне." }, { status: 503 });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let raw = "";
  let visibleSent = "";
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const parsed = JSON.parse(line) as { message?: { content?: string } };
            raw += parsed.message?.content ?? "";
            const visible = stripThinking(raw);
            if (visible.startsWith(visibleSent) && visible.length > visibleSent.length) {
              controller.enqueue(encoder.encode(visible.slice(visibleSent.length)));
              visibleSent = visible;
            }
          }
        }
        const finalText = stripThinking(raw);
        if (finalText && finalText !== visibleSent) controller.enqueue(encoder.encode(finalText.slice(visibleSent.length)));
        await save(user.id, body.mode ?? "explain", "ollama", model, messages, finalText || visibleSent);
      } catch (error) {
        if ((error as Error).name !== "AbortError") controller.error(error);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
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
