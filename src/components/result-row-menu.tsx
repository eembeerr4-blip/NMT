"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ResultDeleteButton } from "@/components/result-editor-dialog";

export function ResultRowMenu({
  id,
  editHref,
  subjectName,
  dateLabel,
}: {
  id: string;
  editHref: string;
  subjectName: string;
  dateLabel: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 px-0" aria-label="Дії з результатом">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="z-50 min-w-[11rem] rounded-xl border border-border bg-card p-1 shadow-lg">
          <DropdownMenu.Item asChild>
            <Link href={editHref} className="block cursor-pointer rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted">
              Редагувати
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="rounded-lg px-1 py-1 outline-none focus:bg-muted"
            onSelect={(event) => event.preventDefault()}
          >
            <ResultDeleteButton id={id} subjectName={subjectName} dateLabel={dateLabel} />
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
