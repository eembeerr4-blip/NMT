import type { ReactNode } from "react";
import { redirect } from "next/navigation";
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
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card className="space-y-3 p-6">
          <h1 className="text-xl font-semibold">База ще не готова</h1>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Не вдалося відкрити базу."}</p>
          <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs">npm run db:setup</pre>
        </Card>
      </main>
    );
  }
  return <AppShell name={user.firstName}>{children}</AppShell>;
}
