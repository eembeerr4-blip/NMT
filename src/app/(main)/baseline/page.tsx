import { Card, PageHeader } from "@/components/ui";
import { BaselineManager } from "@/features/baseline/baseline-manager";
import { getPersonalStudySummary } from "@/features/personal-plan/data";
import { dateKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function BaselinePage() {
  const summary = await getPersonalStudySummary();
  return (
    <>
      <PageHeader title="Стартові результати" description="Додай або онови результати діагностики з Освіта.ua. Значення не переносяться між профілями." />
      {summary.activeSubjects.length === 4
        ? <BaselineManager subjects={summary.activeSubjects} today={dateKey()} />
        : <Card className="p-5 text-sm text-muted-foreground">Щоб додати результати, заверши вибір чотирьох активних предметів у персональному onboarding.</Card>}
    </>
  );
}
