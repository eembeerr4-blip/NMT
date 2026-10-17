import { OnboardingWizard } from "@/components/onboarding-wizard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const owner = await prisma.user.findUnique({ where: { id: "owner" } }).catch(() => null);
  return <OnboardingWizard claim={Boolean(owner && !owner.passwordHash)} />;
}
