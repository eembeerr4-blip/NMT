/**
 * Sentry helpers. Initialization is env-gated so local/CI builds work without DSN.
 * Never log PII (emails, password hashes, session tokens).
 */

export function sentryEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
      process.env.SENTRY_DSN?.trim(),
  );
}

export function sentryEnvironment() {
  return process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
}

/** Fields that must never be sent to error tracking. */
export const SENTRY_DENYLIST = [
  "password",
  "passwordHash",
  "authorization",
  "cookie",
  "token",
  "secret",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "GOOGLE_CLIENT_SECRET",
  "SESSION",
] as const;

export function scrubSentryEvent<T extends { request?: { headers?: Record<string, unknown>; cookies?: unknown; data?: unknown } }>(
  event: T,
): T {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENTRY_DENYLIST.some((item) => key.toLowerCase().includes(item.toLowerCase()))) {
        event.request.headers[key] = "[filtered]";
      }
    }
  }
  if (event.request) {
    delete event.request.cookies;
  }
  return event;
}
