"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  Library,
  Menu,
  NotebookPen,
  RotateCcw,
  Settings,
  Timer,
  X,
  ChevronDown,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { HeaderSearch } from "@/components/header-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/server/actions";
import { cn } from "@/lib/utils";

const primaryItems = [
  { href: "/", label: "Головна", icon: Home },
  { href: "/curriculum", label: "Мій план", icon: ClipboardList },
  { href: "/subjects", label: "Предмети", icon: Library },
  { href: "/tests", label: "Тести", icon: BookOpen },
  { href: "/analytics", label: "Мій прогрес", icon: BarChart3 },
];

const secondaryItems = [
  { href: "/calendar", label: "Календар", icon: CalendarDays },
  { href: "/mistakes", label: "Мої помилки", icon: BookOpen },
  { href: "/exams", label: "Пробники", icon: Timer },
  { href: "/review", label: "Повторення", icon: RotateCcw },
  { href: "/results", label: "Результати", icon: GraduationCap },
  { href: "/notes", label: "Конспекти", icon: NotebookPen },
  { href: "/settings", label: "Налаштування", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if(href==="/subjects" && /^\/(topics|learn)\/[^/]+$/.test(pathname))return true;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ href, label, icon: Icon, pathname, onClick }: {
  href: string;
  label: string;
  icon: typeof Home;
  pathname: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive(pathname, href) ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
        isActive(pathname, href)
          ? "bg-accent text-link"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {label}
    </Link>
  );
}

export function AppShell({ children, name, isAdmin = false, isOwner = false, isEditor = false }: { children: ReactNode; name?: string; isAdmin?: boolean; isOwner?: boolean; isEditor?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("min-h-screen", (pathname === "/" || pathname === "/curriculum" || pathname === "/subjects" || /^\/(subjects|topics|learn)\/[^/]+$/.test(pathname)) && "d01-shell")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        Перейти до вмісту
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        <Link href="/" className="flex items-center gap-3 px-5 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight">NMT Academy</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Твій шлях до мети</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Основна навігація">
          <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Навчання</p>
          {primaryItems.map((item) => <NavigationLink key={item.href} {...item} pathname={pathname} />)}
          <p className="px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Особисте</p>
          {secondaryItems.filter(item=>["/calendar","/mistakes","/settings"].includes(item.href)).map((item) => <NavigationLink key={item.href} {...item} pathname={pathname} />)}
          <details className="pt-1"><summary className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">Ще розділи</summary><div className="mt-1 space-y-1">{secondaryItems.filter(item=>!["/calendar","/mistakes","/settings"].includes(item.href)).map(item=><NavigationLink key={item.href} {...item} pathname={pathname}/>)}</div></details>
        </nav>
        <div className="border-t border-border p-4">
          <div className="truncate text-sm font-medium">{name ?? "Учень"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Особистий кабінет</div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card md:hidden" aria-label="Відкрити меню">
                <Menu className="h-5 w-5" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] overflow-y-auto border-r border-border bg-sidebar p-4 shadow-xl">
                  <div className="mb-5 flex items-center justify-between px-1">
                    <Dialog.Title className="font-semibold">NMT Academy</Dialog.Title><Dialog.Description className="sr-only">Перехід між навчальними розділами та особистими налаштуваннями.</Dialog.Description>
                    <Dialog.Close className="rounded-lg p-2 hover:bg-muted" aria-label="Закрити меню"><X className="h-4 w-4" /></Dialog.Close>
                  </div>
                  <nav className="space-y-1" aria-label="Мобільна навігація">
                    {[...primaryItems, ...secondaryItems].map((item) => (
                      <Dialog.Close key={item.href} asChild>
                        <NavigationLink {...item} pathname={pathname} />
                      </Dialog.Close>
                    ))}
                  </nav>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <HeaderSearch />
            <span className="shell-mobile-brand text-sm font-semibold md:hidden">NMT Academy</span>
          </div>
          <div className="flex shrink-0 items-center gap-2"><Link href="/search" aria-label="Пошук матеріалів" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border sm:hidden"><Search className="h-4 w-4"/></Link><ThemeToggle/><details className="relative"><summary aria-label="Меню профілю" className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-sm hover:bg-muted"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-link">{name?.slice(0,1).toLocaleUpperCase("uk-UA")??"У"}</span><span className="hidden max-w-36 truncate sm:inline">{name??"Профіль"}</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground"/></summary><nav aria-label="Меню профілю" onClick={event=>{if((event.target as Element).closest("a,button"))event.currentTarget.closest("details")?.removeAttribute("open");}} className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl"><Link href="/settings" className="block rounded-xl px-3 py-2.5 text-sm hover:bg-muted">Мої налаштування</Link>{isAdmin?<Link href="/admin" className="block rounded-xl px-3 py-2.5 text-sm hover:bg-muted">{isOwner?"Центр керування власника":"Адмінпанель"}</Link>:null}{isEditor?<Link href="/editor" className="block rounded-xl px-3 py-2.5 text-sm hover:bg-muted">Режим редактора</Link>:null}<form action={logout} className="mt-1 border-t border-border pt-1"><button type="submit" className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted">Вийти</button></form></nav></details></div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-24 sm:px-6 lg:px-8 md:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-sidebar/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Швидка навігація">
        {primaryItems.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className={cn(
            "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium",
            isActive(pathname, item.href) ? "text-link" : "text-muted-foreground",
          )}>
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
