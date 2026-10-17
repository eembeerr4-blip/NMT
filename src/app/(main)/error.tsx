"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h1 className="text-lg font-semibold">Щось пішло не так</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={reset} type="button">Спробувати знову</button>
    </div>
  );
}
