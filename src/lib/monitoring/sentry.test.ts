import { describe, expect, it } from "vitest";
import { scrubSentryEvent, sentryEnabled } from "./sentry";

describe("sentry helpers", () => {
  it("reports disabled when DSN unset", () => {
    const prevPublic = process.env.NEXT_PUBLIC_SENTRY_DSN;
    const prevServer = process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    expect(sentryEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_SENTRY_DSN = prevPublic;
    process.env.SENTRY_DSN = prevServer;
  });

  it("scrubs sensitive headers and drops cookies", () => {
    const event = scrubSentryEvent({
      request: {
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
          cookie: "session=abc",
        },
        cookies: { session: "abc" },
      },
    });
    expect(event.request?.headers?.authorization).toBe("[filtered]");
    expect(event.request?.headers?.cookie).toBe("[filtered]");
    expect(event.request?.headers?.["content-type"]).toBe("application/json");
    expect(event.request?.cookies).toBeUndefined();
  });
});
