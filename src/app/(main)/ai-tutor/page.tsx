import { prisma } from "@/lib/prisma";
import { TutorForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function TutorPage() {
  const user = await requireUser();
  const [settings, topics, conversations, ollama] = await Promise.all([
    getSettings(user.id),
    prisma.topic.findMany({ select: { id: true, title: true, subjectId: true }, orderBy: { sortOrder: "asc" } }),
    prisma.aIConversation.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    fetch("http://127.0.0.1:11434/api/tags", { cache: "no-store" }).then(async (response) => response.ok ? response.json() as Promise<{ models?: { name: string }[] }> : null).catch(() => null),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="AI-репетитор" description={settings.aiProvider === "none" ? "Провайдер не вибрано. Решта платформи працює без ключа." : `Провайдер: ${settings.aiProvider}. Згенеровані завдання не стають перевіреними автоматично.`} />
      <Card className="p-4 text-sm text-muted-foreground">{ollama?.models?.length ? `Локальна Ollama відповідає. Моделі: ${ollama.models.map((model) => model.name).join(", ")}. Оберіть її в налаштуваннях, якщо хочете пояснення без платного API.` : "Ollama зараз не запущена. Календар, тести й аналітика працюють без неї."} Підписка ChatGPT Plus не дає доступу до OpenAI API.</Card>
      <Card className="p-4"><TutorForm topics={topics} /></Card>
      {conversations.length ? (
        <Card className="space-y-2 p-4">
          <h2 className="font-medium">Останні розмови</h2>
          {conversations.map((conversation) => <p key={conversation.id} className="text-sm text-muted-foreground">{conversation.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {conversation.mode} · {conversation.provider}</p>)}
        </Card>
      ) : null}
    </div>
  );
}
