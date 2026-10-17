import { BackupRestoreForm, SettingsForm } from "@/components/forms";
import { Button, Card, PageHeader } from "@/components/ui";
import { ELECTIVE_SUBJECT_IDS, SUBJECTS } from "@/lib/constants";
import { readSecrets } from "@/lib/secrets";
import { dateKey } from "@/lib/dates";
import { changeElective } from "@/server/actions";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const elective = user.subjects.find((item) => item.role === "ELECTIVE" && item.active)?.subjectId;
  const secrets = readSecrets();
  return (
    <div className="space-y-6">
      <PageHeader title="Налаштування" description={`${user.firstName}, тут можна змінити навантаження і предмет на вибір. Історичні результати не видаляються.`} />
      <Card className="space-y-3 p-4">
        <h2 className="font-medium">Предмет на вибір</h2>
        <p className="text-sm text-muted-foreground">Зараз: {SUBJECTS.find((subject) => subject.id === elective)?.name ?? "не обрано"}. Майбутні заняття попереднього предмета зникнуть з активного розкладу, завершені залишаться.</p>
        <form action={async (formData) => { "use server"; await changeElective(String(formData.get("subjectId") ?? ""), formData.get("confirm") === "on"); }} className="flex flex-wrap items-center gap-2">
          <select name="subjectId" defaultValue={elective} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
            {SUBJECTS.filter((subject) => (ELECTIVE_SUBJECT_IDS as readonly string[]).includes(subject.id)).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" /> Підтверджую зміну</label>
          <Button type="submit" variant="outline">Змінити предмет</Button>
        </form>
      </Card>
      <Card className="p-4">
        <SettingsForm
          values={{
            theme: settings.theme as "system",
            examDate: settings.examDate ? settings.examDate.toISOString().slice(0, 10) : "",
            targetScore: settings.targetScore,
            masteryHighMin: settings.masteryHighMin,
            masteryMidMin: settings.masteryMidMin,
            timerEnabled: settings.timerEnabled,
            aiProvider: settings.aiProvider as "none",
            aiModel: settings.aiModel,
            mathPriority: settings.mathPriority,
            ukrainianPriority: settings.ukrainianPriority,
            historyPriority: settings.historyPriority,
            biologyPriority: settings.biologyPriority,
          }}
          scheduleJson={JSON.stringify(settings.schedule, null, 2)}
          formatJson={JSON.stringify(settings.format, null, 2)}
          secrets={{ openai: Boolean(secrets.openaiApiKey), gemini: Boolean(secrets.geminiApiKey), youtube: Boolean(secrets.youtubeApiKey), ollama: secrets.ollamaBaseUrl || "http://127.0.0.1:11434" }}
        />
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-medium">Резервна копія</h2>
        <a className="text-sm underline" href="/api/export/backup">Завантажити JSON</a>
        <BackupRestoreForm />
        <p className="text-xs text-muted-foreground">Сьогодні на сервері: {dateKey()}. Ключі API в копію бази не входять.</p>
      </Card>
    </div>
  );
}
