"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { deleteQuestion, verifyQuestion } from "@/server/actions";
import { Button } from "./ui";

export function QuestionModeration({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function changeStatus(next: "VERIFIED" | "DRAFT") {
    setBusy(true);
    try {
      const result = await verifyQuestion(id, next);
      setMessage(result.ok ? result.message ?? "Збережено." : result.error);
      if (result.ok) router.refresh();
    } catch {
      setMessage("Не вдалося зберегти зміни. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    try {
      const result = await deleteQuestion(id);
      setMessage(result.ok ? result.message ?? "Завдання архівовано." : result.error);
      if (result.ok) setConfirmArchive(false);
      if (result.ok) router.refresh();
    } catch {
      setMessage("Не вдалося архівувати завдання. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "REJECTED" ? <Button variant="outline" disabled={busy} onClick={() => void changeStatus("DRAFT")}>Відновити як чернетку</Button> : null}
        {status !== "VERIFIED" && status !== "REJECTED" ? <Button variant="outline" disabled={busy} onClick={() => void changeStatus("VERIFIED")}>Позначити перевіреним</Button> : null}
        {status !== "REJECTED" ? <Button variant="ghost" disabled={busy} onClick={() => setConfirmArchive(true)}>Архівувати</Button> : null}
      </div>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      <Dialog.Root open={confirmArchive} onOpenChange={(open) => { if (!busy) setConfirmArchive(open); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"/>
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <Dialog.Title className="text-lg font-semibold">Архівувати завдання?</Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-muted-foreground">Запитання буде приховано з активного банку. Історію відповідей і тестових спроб буде збережено.</Dialog.Description>
            <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setConfirmArchive(false)}>Скасувати</Button><Button variant="destructive" disabled={busy} onClick={() => void archive()}>{busy ? "Архівування…" : "Підтвердити архівацію"}</Button></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
