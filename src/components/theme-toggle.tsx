"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"
      onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
      aria-label="Змінити тему"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
      <span className="hidden sm:inline dark:hidden">Темна</span>
      <span className="hidden dark:inline">Світла</span>
    </button>
  );
}

