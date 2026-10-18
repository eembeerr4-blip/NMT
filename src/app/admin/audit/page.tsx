import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/server/session";
import { AUDIT_ACTIONS, safeAuditMetadata } from "@/server/audit-log";

export const dynamic = "force-dynamic";
const pageSize = 30;
const dateFormat = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "medium", timeStyle: "medium" });

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; actor?: string; from?: string; to?: string; page?: string }> }) {
  await requireAdministrator();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const actor = (params.actor ?? "").trim().slice(0, 120);
  const requested = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(requested, 100000)) : 1;
  const action = params.action && Object.hasOwn(AUDIT_ACTIONS, params.action) ? params.action : "";
  const from = validDate(params.from);
  const to = validDate(params.to);
  const dateError = params.from && !from ? "Перевірте дату початку." : params.to && !to ? "Перевірте дату завершення." : from && to && from > to ? "Дата початку має бути не пізніше дати завершення." : "";
  const where: Prisma.AuditLogWhereInput = {
    ...(dateError ? { id: "__no_matching_event__" } : {}),
    ...(action ? { action } : {}),
    ...(actor ? { actorName: { contains: actor } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: endOfDay(to) } : {}) } } : {}),
    ...(query ? { OR: [{ summary: { contains: query } }, { entityId: { contains: query } }] } : {}),
  };
  const [events, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  const url = (next: number) => `/admin/audit?${new URLSearchParams({ q: query, action, actor, from: params.from ?? "", to: params.to ?? "", page: String(next) })}`;
  return <>
    <PageHeader title="Журнал дій" description="Реальні зміни спільних матеріалів, ролей, налаштувань, резервні операції та входи. Час — за Києвом." />
    <Card className="space-y-3 p-4">
      <form key={`${query}:${action}:${actor}:${params.from}:${params.to}`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(180px,1fr)_220px_160px_160px_auto]" role="search">
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Пошук у подіях</span><input name="q" defaultValue={query} aria-label="Пошук у журналі" placeholder="Дія або об’єкт"/></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Ініціатор</span><input name="actor" defaultValue={actor} placeholder="@нікнейм або ім’я"/></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Тип події</span><select name="action" defaultValue={action} aria-label="Тип події"><option value="">Усі події</option>{Object.entries(AUDIT_ACTIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Від</span><input type="date" name="from" defaultValue={params.from ?? ""}/></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">До</span><input type="date" name="to" defaultValue={params.to ?? ""}/></label>
        <div className="flex items-end gap-2"><button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" type="submit">Знайти</button><Link href="/admin/audit" className="inline-flex h-10 items-center rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted">Скинути</Link></div>
      </form>
      {dateError ? <p role="alert" className="text-sm text-danger-text">{dateError}</p> : null}
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

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}
