import { PageHeader } from "@/components/ui";
import { AccountModerationPanel } from "@/components/account-moderation";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  await requireOwner();
  const users = await prisma.user.findMany({
    where: { accountStatus: "PENDING", id: { not: "owner" } },
    select: { id: true, nickname: true, firstName: true, email: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return <>
    <PageHeader title="Модерація реєстрацій" description="Схвалюйте або відхиляйте нові профілі перед тим, як учні отримають доступ до навчання." />
    <AccountModerationPanel users={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))} />
  </>;
}
