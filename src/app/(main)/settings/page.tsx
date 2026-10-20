import { ElectiveForm } from "@/components/elective-form";
import { LearningTimeForm } from "@/components/learning-time-form";
import { SettingsWorkspace } from "@/components/settings-workspace";
import { SettingsForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { SUBJECTS } from "@/lib/constants";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/sync";
import { startGoogleAuth } from "@/server/google-oauth";
import { EmailLinkForm, ProfileEditForm } from "@/components/account-forms";

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
          <div><div className="text-xs text-muted-foreground">Email</div><div className="mt-1 font-medium">{user.email ?? "Не вказано"}</div></div>
        </div>
        <p className="text-xs text-muted-foreground">Для входу можна використати нікнейм або підтверджений email.</p>
        <ProfileEditForm firstName={user.firstName} lastName={user.lastName} examYear={user.examYear} />
        <EmailLinkForm currentEmail={user.email} />
        {process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_BASE_URL ? <form action={startGoogleAuth}>
          <input type="hidden" name="mode" value="link" />
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm">Прив’язати Google до цього профілю</button>
        </form> : null}
      </Card>
</>} learning={<>
      <LearningTimeForm dailyMinutes={settings.dailyMinutes} studyDays={settings.studyDays}/>
      <Card className="space-y-3 p-4">
        <h2 className="font-medium">Предмет на вибір</h2>
        <p className="text-sm text-muted-foreground">Зараз: {SUBJECTS.find((subject) => subject.id === elective)?.name ?? "не обрано"}. Майбутні заняття попереднього предмета буде замінено; завершені заняття й результати збережуться.</p>
        <ElectiveForm elective={elective} />
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
