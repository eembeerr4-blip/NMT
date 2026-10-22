import { OnboardingWizard } from "@/components/onboarding-wizard";
import { prisma } from "@/lib/prisma";
import { accountStatus } from "@/lib/account-status";
import { getSessionUser } from "@/server/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const signedIn = await getSessionUser();
  const owner = await prisma.user.findUnique({ where: { id: "owner" } }).catch(() => null);
  const claim = Boolean(owner && !owner.passwordHash);
  if (!signedIn && !claim) redirect("/register");
  if (signedIn && accountStatus(signedIn) === "PENDING") redirect("/pending");
  if (signedIn && accountStatus(signedIn) === "REJECTED") redirect("/login?rejected=1");
  if (signedIn?.onboarded) redirect("/");
  return <OnboardingWizard claim={claim} account={signedIn ? {
    id: signedIn.id, firstName: signedIn.firstName, lastName: signedIn.lastName, nickname: signedIn.nickname,
    examYear: signedIn.examYear, hasPassword: Boolean((await prisma.user.findUnique({ where: { id: signedIn.id }, select: { passwordHash: true } }))?.passwordHash),
  } : undefined} />;
}
