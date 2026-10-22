import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/server/actions";
import { Card, PageHeader } from "@/components/ui";
import { accountStatus } from "@/lib/account-status";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function PendingAccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const status = accountStatus(user);
  if (status === "REJECTED") redirect("/login?rejected=1");
  if (status === "APPROVED") redirect(user.onboarded ? "/" : "/onboarding");
  if (status !== "PENDING") redirect("/login");
  return (
    <main className="stage02-auth mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
      <Card className="w-full space-y-4 p-6">
        <PageHeader title="Заявку перевіряють" description={`@${user.nickname}, власник платформи має схвалити ваш профіль перед початком навчання.`} />
        <p className="text-sm text-muted-foreground">Після схвалення ви зможете завершити налаштування профілю та відкрити уроки, тести й календар. Поки що навчальний контент недоступний.</p>
        <p className="text-sm text-muted-foreground">Якщо ви вже отримали схвалення, оновіть сторінку або увійдіть знову.</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/pending" className="underline">Оновити статус</Link>
          <form action={logout}><button type="submit" className="underline">Вийти</button></form>
        </div>
      </Card>
    </main>
  );
}
