"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, ClipboardList, FileText, LayoutDashboard, Library, ListTree, Settings, UserCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const baseSections = [
  { href: "/admin", label: "Огляд", icon: LayoutDashboard },
  { href: "/admin/moderation", label: "Модерація заявок", icon: UserCheck, ownerOnly: true },
  { href: "/admin/users", label: "Користувачі та ролі", icon: Users },
  { href: "/admin/subjects", label: "Предмети", icon: Library },
  { href: "/admin/topics", label: "Розділи та теми", icon: ListTree },
  { href: "/admin/lessons", label: "Уроки", icon: BookOpen },
  { href: "/admin/questions", label: "Банк запитань", icon: ClipboardList },
  { href: "/admin/tasks", label: "Навчальні заняття", icon: ClipboardList },
  { href: "/admin/tests", label: "Тести", icon: FileText },
  { href: "/admin/settings", label: "Налаштування", icon: Settings },
  { href: "/admin/audit", label: "Журнал дій", icon: Activity },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function adminNavActive(pathname: string, href: string, hrefs: string[]) {
  const path = normalizePath(pathname);
  const matches = hrefs.filter((candidate) => {
    if (candidate === "/admin") return path === "/admin";
    return path === candidate || path.startsWith(`${candidate}/`);
  });
  if (!matches.length) return false;
  const activeHref = matches.reduce((best, next) => (next.length > best.length ? next : best));
  return activeHref === href;
}

export function AdminNav({ mobile = false, isOwner = false }: { mobile?: boolean; isOwner?: boolean }) {
  const pathname = usePathname();
  const sections = baseSections.filter((section) => !section.ownerOnly || isOwner);
  const hrefs = sections.map((section) => section.href);
  return (
    <nav
      aria-label={mobile ? "Мобільна навігація адміністратора" : "Навігація адміністратора"}
      className={mobile ? "grid grid-cols-2 gap-1 pb-2 pt-2" : "flex-1 space-y-1 overflow-y-auto p-3"}
    >
      {sections.map(({ href, label, icon: Icon }) => {
        const active = adminNavActive(pathname, href, hrefs);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (mobile) event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-accent text-link" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
