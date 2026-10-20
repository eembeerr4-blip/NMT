// A local safety net. Public multi-instance deployments must enforce a shared limit at the edge.
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; startedAt: number }>();
let calls = 0;

export type AuthRequestKind = "register" | "resend" | "google";

export function takeAuthRequest(kind: AuthRequestKind, trustedIp: string | null) {
  const limit = trustedIp ? (kind === "register" ? 10 : kind === "resend" ? 20 : 30) : 120;
  const key = `${kind}:${trustedIp ?? "unattributed"}`;
  const now = Date.now();
  const previous = attempts.get(key);
  const entry = !previous || now - previous.startedAt >= WINDOW_MS
    ? { count: 0, startedAt: now }
    : previous;
  if (entry.count >= limit) return false;
  entry.count++;
  attempts.set(key, entry);
  if (++calls % 100 === 0) {
    for (const [storedKey, value] of attempts) {
      if (now - value.startedAt >= WINDOW_MS) attempts.delete(storedKey);
    }
  }
  return true;
}
