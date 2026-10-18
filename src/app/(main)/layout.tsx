import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdministrator, isOwner, effectiveRole } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/server/session";
import { syncPlan } from "@/server/sync";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");
  try {
    await syncPlan(user.id);
  } catch (error) {
    console.error("[main-layout] Unable to synchronize the learner plan.", error);
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card className="space-y-3 p-6">
          <h1 className="text-xl font-semibold">Не вдалося завантажити навчальні дані</h1>
          <p className="text-sm text-muted-foreground">Спробуйте ще раз трохи пізніше. Збережені результати та прогрес не змінено.</p>
          <Link href="/" className="inline-flex w-fit rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Спробувати ще раз</Link>
        </Card>
      </main>
    );
  }
  return <AppShell name={user.firstName} isAdmin={isAdministrator(user)} isOwner={isOwner(user)} isEditor={effectiveRole(user)==="EDITOR"}>{children}</AppShell>;
}
