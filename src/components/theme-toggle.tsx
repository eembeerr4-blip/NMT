"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-0 text-sm sm:w-28 sm:px-3"
        aria-label="Змінити тему"
        title="Змінити тему інтерфейсу"
        disabled
      >
        <Moon className="h-4 w-4 opacity-50" />
        <span className="hidden w-12 text-center sm:inline-block opacity-50">Тема</span>
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-0 text-sm sm:w-28 sm:px-3 hover:bg-muted"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Змінити тему"
      title="Змінити тему інтерфейсу"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden w-12 text-center sm:inline-block">Тема</span>
    </button>
  );
}
