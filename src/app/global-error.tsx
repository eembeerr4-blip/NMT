"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="uk">
      <body className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6 font-sans">
        <h1 className="text-xl font-semibold">Сталася помилка</h1>
        <p className="text-sm text-neutral-600">
          Спробуйте оновити сторінку. Технічні деталі не показуються з міркувань безпеки.
        </p>
        <button type="button" className="rounded bg-neutral-900 px-4 py-2 text-white" onClick={() => reset()}>
          Спробувати знову
        </button>
      </body>
    </html>
  );
}
