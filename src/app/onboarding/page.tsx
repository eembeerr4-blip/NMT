import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { loadOnboardingPageData } from "@/features/onboarding/page-data";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const data = await loadOnboardingPageData();
  return <OnboardingFlow key={data.user?.id ?? "new-profile"} data={data} />;
}
