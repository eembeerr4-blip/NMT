"use client";
import { useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { startTopicTest } from "@/server/actions";
import { TestingSubmitButton } from "./submit-button";
/** Existing topic restart action; preserve redirect and show errors without clearing history. */
export function RestartTopicTest({ topicId }: { topicId: string }) {
  const [error, setError] = useState("");
  return <form action={async () => {
    setError("");
    try {
      const result = await startTopicTest(topicId);
      if (result && !result.ok) setError(result.error);
    } catch (cause) {
      unstable_rethrow(cause);
      setError("Не вдалося розпочати нову спробу. Перевірте з’єднання та повторіть.");
    }
  }}>
    <TestingSubmitButton>Пройти новий варіант</TestingSubmitButton>
    {error ? <p role="alert" className="d05-notice d05-error">{error}</p> : null}
  </form>;
}
