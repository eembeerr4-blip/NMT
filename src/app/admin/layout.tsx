import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { effectiveRole, isOwner, ROLE_INFO } from "@/lib/permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/server/actions";
import { requireAdministrator } from "@/server/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdministrator();
  const ownerNav = isOwner(user);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-sidebar md:flex md:flex-col">
        <Link href="/admin" className="flex items-center gap-3 border-b border-border px-5 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" /></span>
          <span><span className="block text-sm font-bold">NMT Academy</span><span className="text-xs text-muted-foreground">Адміністрування</span></span>
        </Link>
        <AdminNav isOwner={ownerNav} />
        <div className="border-t border-border p-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Повернутися до навчання</Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <div className="min-w-0">
            <div className="text-sm font-semibold"><span className="hidden sm:inline">Адміністративна панель</span><span className="sm:hidden">Керування</span></div>
            <div className="hidden text-xs text-muted-foreground sm:block">{user.firstName} · {ROLE_INFO[effectiveRole(user)].label}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><span className="hidden sm:inline">Повернутися до навчання</span><span className="sm:hidden">До навчання</span></Link>
            <ThemeToggle />
            <form action={logout}><button type="submit" className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Вийти</button></form>
          </div>
        </header>
        <details className="border-b border-border bg-sidebar px-4 py-2 md:hidden">
          <summary className="cursor-pointer py-1 text-sm font-medium">Розділи адміністратора</summary>
          <AdminNav mobile isOwner={ownerNav} />
        </details>
        <main id="main" className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
