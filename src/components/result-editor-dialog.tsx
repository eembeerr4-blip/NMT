"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ResultForm } from "@/components/forms";
import { Button } from "@/components/ui";
import { deleteExamResult } from "@/server/actions";

type ResultInitial = NonNullable<Parameters<typeof ResultForm>[0]["initial"]>;

export function ResultEditorDialog({ open, initial }: { open: boolean; initial?: ResultInitial }) {
  const router = useRouter();
  const title = initial ? "Виправити результат" : "Додати результат";
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) router.push("/results"); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
          <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mb-5 mt-1 text-sm text-muted-foreground">
            Тестовий і рейтинговий бали зберігаються окремо. Редагування змінить лише цей запис у вашому журналі.
          </Dialog.Description>
          <ResultForm initial={initial} />
          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild><Button variant="ghost">Скасувати</Button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ResultDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function removeResult() {
    if (!window.confirm("Видалити цей результат? Цю дію не можна скасувати.")) return;
    setPending(true);
    setMessage("");
    try {
      const result = await deleteExamResult(id);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
    } catch {
      setMessage("Не вдалося видалити результат. Спробуйте ще раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void removeResult()}>{pending ? "Видалення…" : "Видалити"}</Button>
      {message ? <span role="alert" className="max-w-52 text-right text-xs text-danger-text">{message}</span> : null}
    </span>
  );
}
