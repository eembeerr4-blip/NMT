import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/server/session";
import { AUDIT_ACTIONS, safeAuditMetadata } from "@/server/audit-log";

export const dynamic = "force-dynamic";
const pageSize = 30;
const dateFormat = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "medium", timeStyle: "medium" });

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; page?: string }> }) {
  await requireAdministrator();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const requested = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(requested, 100000)) : 1;
  const action = params.action && Object.hasOwn(AUDIT_ACTIONS, params.action) ? params.action : "";
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(query ? { OR: [{ actorName: { contains: query } }, { summary: { contains: query } }, { entityId: { contains: query } }] } : {}),
  };
  const [events, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  const url = (next: number) => `/admin/audit?${new URLSearchParams({ q: query, action, page: String(next) })}`;
  return <>
    <PageHeader title="Журнал дій" description="Реальні зміни спільних матеріалів, ролей, налаштувань, резервні операції та входи. Час — за Києвом." />
    <Card className="space-y-3 p-4">
      <form key={`${query}:${action}`} className="flex flex-wrap gap-3" role="search">
        <input name="q" defaultValue={query} aria-label="Пошук у журналі" placeholder="Хто виконав дію або що змінилося" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <select name="action" defaultValue={action} aria-label="Тип події" className="max-w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="">Усі події</option>{Object.entries(AUDIT_ACTIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <button className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">Знайти</button>
        <Link href="/admin/audit" className="self-center text-sm underline">Скинути</Link>
      </form>
      <p className="text-xs text-muted-foreground">Знайдено: {total.toLocaleString("uk-UA")}. Паролі, ключі API та вміст особистих нотаток не записуються. Події до увімкнення журналу не відновлюються заднім числом.</p>
    </Card>
    {events.length ? <div className="space-y-3">{events.map(event => {
      let details = {};
      try { details = safeAuditMetadata(JSON.parse(event.metadataJson)); } catch { /* Older malformed metadata must not break the log. */ }
      return <Card key={event.id} className="space-y-2 p-4" data-audit-id={event.id}>
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold">{event.summary}</h2><time dateTime={event.createdAt.toISOString()} className="text-xs text-muted-foreground">{dateFormat.format(event.createdAt)}</time></div>
        <p className="text-sm">{event.actorName} · {event.actorRole === "OWNER" ? "Власник" : event.actorRole === "ADMIN" ? "Адміністратор" : event.actorRole === "EDITOR" ? "Редактор" : event.actorRole === "STUDENT" ? "Учень" : "Система"}</p>
        <p className="break-all text-xs text-muted-foreground">Об’єкт: {({ subject: "Предмет", system: "Система", session: "Авторизація", video: "Відео", question: "Завдання", topic: "Тема", settings: "Налаштування", user: "Профіль", backup: "Резервна копія" } as Record<string,string>)[event.entityType] ?? event.entityType}{event.entityId ? ` · ${event.entityId}` : ""}</p>
        {Object.keys(details).length ? <details className="text-sm"><summary className="cursor-pointer">Деталі</summary><dl className="mt-2 space-y-1">{Object.entries(details).map(([key, value]) => <div key={key}><dt className="inline font-medium">{({ fields: "Змінені поля", role: "Нова роль", previousRole: "Попередня роль", imported: "Імпортовано", skipped: "Пропущено", count: "Кількість", version: "Версія копії" } as Record<string, string>)[key] ?? key}: </dt><dd className="inline">{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}</dl></details> : null}
      </Card>;
    })}</div> : <Card className="p-5"><h2 className="font-semibold">{query || action ? "Подій за цим фільтром немає" : "Подій ще немає"}</h2><p className="mt-2 text-sm text-muted-foreground">Журнал автоматично зберігатиме нові дії. Старі зміни, які не журналювалися, тут не вигадуються.</p></Card>}
    <nav aria-label="Сторінки журналу" className="flex flex-wrap items-center gap-4 text-sm">{page > 1 ? <Link href={url(page - 1)} className="underline">Назад</Link> : null}<span>Сторінка {page} · {Math.max(1, Math.ceil(total / pageSize))} усього</span>{page * pageSize < total ? <Link href={url(page + 1)} className="underline">Далі</Link> : null}</nav>
  </>;
}
