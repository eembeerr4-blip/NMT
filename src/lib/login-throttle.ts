import { isIP } from "node:net";

const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LIMIT = 10;
const IP_LIMIT = 30;
const UNATTRIBUTED_LIMIT = 120;
const failures = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();
let calls = 0;

function bucketLocked(key: string) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  if (Date.now() - entry.firstAt >= WINDOW_MS) failures.delete(key);
  return false;
}

function addFailure(key: string, limit: number) {
  const now = Date.now();
  const previous = failures.get(key);
  const entry = !previous || now - previous.firstAt >= WINDOW_MS
    ? { count: 0, firstAt: now, lockedUntil: 0 }
    : previous;
  if (entry.lockedUntil > now) return;
  entry.count++;
  if (entry.count >= limit) entry.lockedUntil = now + WINDOW_MS;
  failures.set(key, entry);
  if (++calls % 100 === 0) {
    for (const [storedKey, value] of failures) {
      if (value.lockedUntil <= now && now - value.firstAt >= WINDOW_MS) failures.delete(storedKey);
    }
  }
}

// The reverse proxy must remove incoming copies and set exactly one validated client IP.
// Direct requests never trust X-Forwarded-For or any other client-supplied IP header.
export function trustedClientIp(requestHeaders: Headers, trustedProxy = process.env.AUTH_TRUSTED_PROXY === "1") {
  if (!trustedProxy) return null;
  const value = requestHeaders.get("x-nmt-client-ip")?.trim();
  return value && isIP(value) ? value.toLowerCase() : null;
}

function sourceKey(ip: string | null) {
  return ip ? `ip:${ip}` : "source:unattributed";
}

export function isLoginLimited(accountKey: string, ip: string | null) {
  return bucketLocked(`account:${accountKey}`) || bucketLocked(sourceKey(ip));
}

export function registerLoginFailure(accountKey: string, ip: string | null) {
  addFailure(`account:${accountKey}`, ACCOUNT_LIMIT);
  addFailure(sourceKey(ip), ip ? IP_LIMIT : UNATTRIBUTED_LIMIT);
}

export function clearAccountFailures(accountKey: string) {
  failures.delete(`account:${accountKey}`);
}
