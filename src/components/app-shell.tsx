"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  Library,
  Menu,
  NotebookPen,
  RotateCcw,
  Settings,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/server/actions";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Головна", icon: Home },
  { href: "/subjects", label: "Предмети", icon: Library },
  { href: "/tests", label: "Тести", icon: ClipboardList },
  { href: "/exams", label: "Пробники", icon: Timer },
  { href: "/results", label: "Результати", icon: GraduationCap },
  { href: "/analytics", label: "Аналітика", icon: BarChart3 },
  { href: "/calendar", label: "Календар", icon: CalendarDays },
  { href: "/mistakes", label: "Помилки", icon: BookOpen },
  { href: "/review", label: "Повторення", icon: RotateCcw },
  { href: "/notes", label: "Конспекти", icon: NotebookPen },
  { href: "/ai-tutor", label: "AI-репетитор", icon: Sparkles },
  { href: "/settings", label: "Налаштування", icon: Settings },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, name }: { children: React.ReactNode; name?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const bottom = [items[0], items[1], items[6], items[5]];
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Перейти до вмісту</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <Brain className="h-5 w-5" />
          <div>
            <div className="text-sm font-semibold">NMT Academy</div>
            <div className="text-xs text-muted-foreground">Підготовка до НМТ-2027</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4" aria-label="Основна навігація">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", active(pathname, item.href) ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 md:hidden">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border" aria-label="Відкрити меню">
                <Menu className="h-4 w-4" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-card p-4 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <Dialog.Title className="font-semibold">NMT Academy</Dialog.Title>
                    <Dialog.Close className="rounded-lg p-2" aria-label="Закрити меню"><X className="h-4 w-4" /></Dialog.Close>
                  </div>
                  <nav className="space-y-1">
                    {items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                        <item.icon className="h-4 w-4" /> {item.label}
                      </Link>
                    ))}
                  </nav>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="text-sm font-semibold">NMT Academy</span>
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">{name ? `Профіль: ${name}` : "NMT Academy"}</div>
          <div className="flex items-center gap-2">
            <form action={logout}><button className="text-sm underline" type="submit">Вийти</button></form>
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-5 pb-24 md:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card md:hidden" aria-label="Мобільна навігація">
        {bottom.map((item) => (
          <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 px-1 py-2 text-[11px]", active(pathname, item.href) ? "text-foreground" : "text-muted-foreground")}>
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
        <Dialog.Root>
          <Dialog.Trigger className="flex flex-col items-center gap-1 px-1 py-2 text-[11px] text-muted-foreground">
            <Menu className="h-4 w-4" /> Більше
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Dialog.Content className="fixed inset-x-3 bottom-16 z-50 rounded-2xl border border-border bg-card p-3 shadow-xl">
              <Dialog.Title className="px-2 py-1 text-sm font-medium">Розділи</Dialog.Title>
              <div className="grid grid-cols-2 gap-1">
                {items.filter((item) => !bottom.includes(item)).map((item) => (
                  <Dialog.Close key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent">
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  </Dialog.Close>
                ))}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </nav>
    </div>
  );
}
