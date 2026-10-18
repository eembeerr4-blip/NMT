"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNote } from "@/server/actions";
import { Button } from "@/components/ui";

export function NoteDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Видалити цей конспект? Цю дію не можна скасувати.")) return;
    setPending(true);
    setError("");
    try {
      const result = await deleteNote(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Не вдалося видалити конспект. Спробуйте ще раз.");
    } finally {
      setPending(false);
    }
  }

  return <span className="inline-flex flex-col items-end gap-1">
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void remove()}>{pending ? "Видалення…" : "Видалити"}</Button>
    {error ? <span role="alert" className="max-w-52 text-right text-xs text-danger-text">{error}</span> : null}
  </span>;
}
