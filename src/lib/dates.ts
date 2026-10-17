import { addDays, format, parseISO } from "date-fns";
import { uk } from "date-fns/locale";

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDateKeys(key: string, days: number) {
  return dateKey(addDays(parseDateKey(key), days));
}

export function formatUk(date: Date | string, pattern = "d MMMM yyyy") {
  const value = typeof date === "string" ? parseISO(date) : date;
  return format(value, pattern, { locale: uk });
}

export function startOfWeekMonday(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: dateKey(start), end: dateKey(end) };
}

export function daysBetween(fromKey: string, toKey: string) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function noonUtc(key: string) {
  return new Date(`${key}T12:00:00.000Z`);
}
