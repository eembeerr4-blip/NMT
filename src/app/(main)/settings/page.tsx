import { SettingsWorkspace } from "@/components/settings-workspace";
import { SettingsForm } from "@/components/forms";
import { Button, Card, PageHeader } from "@/components/ui";
import { ELECTIVE_SUBJECT_IDS, SUBJECTS } from "@/lib/constants";
import { changeElective } from "@/server/actions";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const elective = user.subjects.find((item) => item.role === "ELECTIVE" && item.active)?.subjectId;
  return (
    <div className="space-y-6">
      <PageHeader title="Налаштування" description={`${user.firstName}, тут можна змінити навантаження і предмет на вибір. Історичні результати не видаляються.`} />
      <SettingsWorkspace profile={<>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Профіль</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div><div className="text-xs text-muted-foreground">Ім’я</div><div className="mt-1 font-medium">{user.firstName} {user.lastName}</div></div>
          <div><div className="text-xs text-muted-foreground">Нікнейм</div><div className="mt-1 font-medium">@{user.nickname}</div></div>
          <div><div className="text-xs text-muted-foreground">Рік НМТ</div><div className="mt-1 font-medium">{user.examYear}</div></div>
        </div>
        <p className="text-xs text-muted-foreground">Нікнейм використовується для входу в профіль.</p>
      </Card>
</>} learning={<>
      <Card className="space-y-3 p-4">
        <h2 className="font-medium">Предмет на вибір</h2>
        <p className="text-sm text-muted-foreground">Зараз: {SUBJECTS.find((subject) => subject.id === elective)?.name ?? "не обрано"}. Майбутні заняття попереднього предмета буде замінено; завершені заняття й результати збережуться.</p>
        <form action={async (formData) => { "use server"; await changeElective(String(formData.get("subjectId") ?? ""), formData.get("confirm") === "on"); }} className="flex flex-wrap items-center gap-2">
          <select name="subjectId" defaultValue={elective} className="h-10 rounded-lg border border-border bg-card px-3 text-sm">
            {SUBJECTS.filter((subject) => (ELECTIVE_SUBJECT_IDS as readonly string[]).includes(subject.id)).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" /> Підтверджую зміну</label>
          <Button type="submit" variant="outline">Змінити предмет</Button>
        </form>
      </Card>
      <Card className="p-4">
        <SettingsForm showTheme={false}
          values={{
            theme: settings.theme as "system",
            examDate: settings.examDate ? settings.examDate.toISOString().slice(0, 10) : "",
            targetScore: settings.targetScore,
            masteryHighMin: settings.masteryHighMin,
            masteryMidMin: settings.masteryMidMin,
            timerEnabled: settings.timerEnabled,
            aiProvider: "none",
            aiModel: "",
            mathPriority: settings.mathPriority,
            ukrainianPriority: settings.ukrainianPriority,
            historyPriority: settings.historyPriority,
            biologyPriority: settings.biologyPriority,
          }}
        />
      </Card>
</>}/>

    </div>
  );
}
