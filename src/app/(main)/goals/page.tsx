import { Card, PageHeader } from "@/components/ui";
import { GoalEditor } from "@/features/personal-plan/goal-editor";
import { getPersonalStudySummary } from "@/features/personal-plan/data";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const summary = await getPersonalStudySummary();
  return (
    <>
      <PageHeader title="Мої цілі" description="Особисті цільові бали та їхній вплив на наступні заняття." />
      {summary.activeSubjects.length === 4
        ? <GoalEditor subjects={summary.activeSubjects} />
        : <Card className="p-5 text-sm text-muted-foreground">Для налаштування цілей потрібні чотири активні предмети у профілі.</Card>}
    </>
  );
}
