import Link from "next/link";
import { Card } from "@/components/ui";
import { InvitationForm } from "@/components/account-forms";
import { effectiveRole } from "@/lib/permissions";
import { requireUser } from "@/server/session";
import { notFound } from "next/navigation";

export default async function InvitationsPage() {
  const user = await requireUser();
  if (effectiveRole(user) !== "OWNER") notFound();
  return <main className="mx-auto max-w-xl space-y-4 p-6">
    <Link href="/admin/users" className="text-sm underline">← Користувачі</Link>
    <Card className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Особисті запрошення</h1>
      <InvitationForm />
    </Card>
  </main>;
}
