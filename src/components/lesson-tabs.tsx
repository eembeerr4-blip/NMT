"use client";

import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "video", label: "Відео" },
  { value: "notes", label: "Конспект" },
  { value: "examples", label: "Приклади" },
  { value: "practice", label: "Практика" },
];

export function LessonTabs({ video, notes, examples, practice }: {
  video: ReactNode;
  notes: ReactNode;
  examples: ReactNode;
  practice: ReactNode;
}) {
  const content: Record<(typeof tabs)[number]["value"], ReactNode> = { video, notes, examples, practice };
  return (
    <Tabs.Root defaultValue="notes" className="space-y-4">
      <Tabs.List aria-label="Матеріали уроку" className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-muted p-1">
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} className={cn(
            "rounded-xl px-2 py-2.5 text-xs font-medium text-muted-foreground sm:text-sm",
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
          )}>{tab.label}</Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => <Tabs.Content key={tab.value} value={tab.value} className="min-w-0 focus-visible:outline-none">{content[tab.value]}</Tabs.Content>)}
    </Tabs.Root>
  );
}
