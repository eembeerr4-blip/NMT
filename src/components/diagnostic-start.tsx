"use client";

import { useState } from "react";
import { startDiagnostic, skipDiagnostic } from "@/server/actions";
import { Button } from "./ui";

export function DiagnosticStart() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          const result = await startDiagnostic();
          if (result && !result.ok) setMessage(result.error);
        } finally { setBusy(false); }
      }}>{busy ? "Підготовка…" : "Пройти діагностику"}</Button>
      <Button variant="outline" disabled={busy} onClick={async () => {
        const result = await skipDiagnostic();
        setMessage(result.ok ? "Можна почати навчання без діагностики." : result.error);
      }}>Пропустити</Button>
    </div>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}
