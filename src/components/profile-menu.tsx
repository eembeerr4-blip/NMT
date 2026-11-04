"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { logout } from "@/server/actions";

const CLOSE_DELAY_MS = 180;

export function ProfileMenu({
  name,
  isAdmin = false,
  isOwner = false,
  isEditor = false,
}: {
  name?: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  isEditor?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  return (
    <div className="relative">
      <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenu.Trigger
          aria-label="Меню профілю"
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onPointerEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onClick={(event) => {
            event.preventDefault();
            cancelClose();
            if (!open) setOpen(true);
          }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-link"
            suppressHydrationWarning
          >
            {name?.slice(0, 1).toUpperCase() ?? "У"}
          </span>
          <span className="hidden max-w-36 truncate sm:inline">{name ?? "Профіль"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl"
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            onEscapeKeyDown={() => setOpen(false)}
            onInteractOutside={() => setOpen(false)}
          >
            <MenuLink href="/settings" onNavigate={() => setOpen(false)}>Мої налаштування</MenuLink>
            {isAdmin ? (
              <MenuLink href="/admin" onNavigate={() => setOpen(false)}>
                {isOwner ? "Центр керування власника" : "Адмінпанель"}
              </MenuLink>
            ) : null}
            {isEditor ? (
              <MenuLink href="/editor" onNavigate={() => setOpen(false)}>Режим редактора</MenuLink>
            ) : null}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item asChild onSelect={(event) => event.preventDefault()}>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted focus:bg-muted"
                >
                  Вийти
                </button>
              </form>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function MenuLink({ href, children, onNavigate }: { href: string; children: ReactNode; onNavigate: () => void }) {
  return (
    <DropdownMenu.Item asChild onSelect={onNavigate}>
      <Link href={href} className="block cursor-pointer rounded-xl px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted">
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}
