"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, Library, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type NavChild = { href: string; label: string; ownerOnly?: boolean };
type NavGroup = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href?: string;
  ownerOnly?: boolean;
  children?: NavChild[];
};

const navGroups: NavGroup[] = [
  { id: "overview", label: "Огляд", icon: LayoutDashboard, href: "/admin" },
  {
    id: "users",
    label: "Користувачі",
    icon: Users,
    children: [
      { href: "/admin/moderation", label: "Заявки", ownerOnly: true },
      { href: "/admin/users", label: "Користувачі та ролі" },
    ],
  },
  {
    id: "content",
    label: "Навчальний контент",
    icon: Library,
    children: [
      { href: "/admin/subjects", label: "Предмети" },
      { href: "/admin/topics", label: "Розділи та теми" },
      { href: "/admin/lessons", label: "Уроки" },
      { href: "/admin/tasks", label: "Навчальні заняття" },
    ],
  },
  {
    id: "testing",
    label: "Тестування",
    icon: ClipboardList,
    children: [
      { href: "/admin/questions", label: "Банк запитань" },
      { href: "/admin/tests", label: "Тести" },
    ],
  },
  {
    id: "system",
    label: "Система",
    icon: Settings,
    children: [
      { href: "/admin/settings", label: "Налаштування" },
      { href: "/admin/audit", label: "Журнал дій" },
    ],
  },
];

export const adminNavHrefs = [
  "/admin",
  "/admin/moderation",
  "/admin/users",
  "/admin/subjects",
  "/admin/topics",
  "/admin/lessons",
  "/admin/questions",
  "/admin/tasks",
  "/admin/tests",
  "/admin/settings",
  "/admin/audit",
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

function groupActive(pathname: string, group: NavGroup, hrefs: string[]) {
  if (group.href) return adminNavActive(pathname, group.href, hrefs);
  return group.children?.some((child) => adminNavActive(pathname, child.href, hrefs)) ?? false;
}

export function AdminNav({ mobile = false, isOwner = false }: { mobile?: boolean; isOwner?: boolean }) {
  const pathname = usePathname();
  const hrefs = adminNavHrefs;

  return (
    <nav
      aria-label={mobile ? "Мобільна навігація адміністратора" : "Навігація адміністратора"}
      className={mobile ? "grid grid-cols-1 gap-2 pb-2 pt-2" : "flex-1 space-y-3 overflow-y-auto p-3"}
    >
      {navGroups.map((group) => {
        if (group.href) {
          const active = adminNavActive(pathname, group.href, hrefs);
          return (
            <Link
              key={group.id}
              href={group.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-accent text-link" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <group.icon className="h-[18px] w-[18px] shrink-0" />
              <span>{group.label}</span>
            </Link>
          );
        }

        const children = (group.children ?? []).filter((child) => !child.ownerOnly || isOwner);
        if (!children.length) return null;
        const open = groupActive(pathname, group, hrefs);

        return (
          <div key={group.id} className="space-y-1">
            <p className={cn("px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", open ? "text-foreground" : "text-muted-foreground")}>
              <group.icon className="mr-2 inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />
              {group.label}
            </p>
            <div className={mobile ? "grid grid-cols-2 gap-1" : "space-y-0.5"}>
              {children.map((child) => {
                const active = adminNavActive(pathname, child.href, hrefs);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => {
                      if (mobile) event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-accent text-link" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
