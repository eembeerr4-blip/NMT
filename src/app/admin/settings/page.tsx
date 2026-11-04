import Link from "next/link";
import { BackupRestoreForm, PlatformConfigForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { dateKey, formatUk } from "@/lib/dates";
import { isOwner } from "@/lib/permissions";
import { requireAdministrator } from "@/server/session";
import { ensureUserSettings, getSettings } from "@/server/sync";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireAdministrator();
  await ensureUserSettings(user.id);
  const settings = await getSettings(user.id);
  return (
    <>
      <PageHeader title="Налаштування платформи" description="Інструменти адміністратора, що вже підтримуються проєктом." />
      {isOwner(user) ? <Card className="space-y-5 p-5 sm:p-6"><div><h2 className="text-lg font-semibold">Резервне копіювання</h2><p className="mt-1 text-sm text-muted-foreground">Збереження та відновлення даних платформи. Доступно лише власнику.</p></div><BackupRestoreForm/><p className="text-xs text-muted-foreground">Сьогодні: {formatUk(dateKey())}.</p></Card> : null}
      <Card className="space-y-2 p-5">
        <h2 className="font-semibold">Параметри облікового запису</h2>
        <p className="text-sm text-muted-foreground">Тема інтерфейсу та навчальні вподобання керуються в персональних налаштуваннях. Інтеграції AI у цій панелі не вмикаються.</p>
        <Link href="/settings" className="inline-flex text-sm font-medium text-primary hover:underline">Відкрити персональні налаштування →</Link>
      </Card>
      <Card className="space-y-2 p-5">
        <h2 className="font-semibold">Керування доступом</h2>
        <p className="text-sm text-muted-foreground">Ролі змінюються в переліку користувачів. Власник може призначати іншим профілям будь-яку роль. Адміністратор керує редакторами й учнями.</p>
        <Link href="/admin/users" className="inline-flex text-sm font-medium text-primary hover:underline">До користувачів →</Link>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Конфігурація навчання</h2>
        <p className="text-sm text-muted-foreground">Наявні редактори конфігурації збережені лише в налаштуваннях профілю адміністратора. Вони не змінюють предметний контент і не вмикають AI.</p>
        <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Додаткові параметри навчання</summary><div className="pt-4"><PlatformConfigForm scheduleJson={JSON.stringify(settings.schedule, null, 2)} formatJson={JSON.stringify(settings.format, null, 2)} /></div></details>
      </Card>
    </>
  );
}
