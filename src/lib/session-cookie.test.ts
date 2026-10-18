import { describe, expect, it } from "vitest";
import { sessionCookieSecure } from "./session-cookie";

describe("session cookie transport", () => {
  it("requires HTTPS in production by default", () => {
    expect(sessionCookieSecure({ NODE_ENV: "production" })).toBe(true);
  });

  it("allows the explicit local HTTP configuration in a production build", () => {
    expect(sessionCookieSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: "false" })).toBe(false);
  });

  it("keeps HTTPS when explicitly configured", () => {
    expect(sessionCookieSecure({ NODE_ENV: "development", SESSION_COOKIE_SECURE: "true" })).toBe(true);
  });

  it("supports HTTP during development", () => {
    expect(sessionCookieSecure({ NODE_ENV: "development" })).toBe(false);
  });

  it("does not silently accept a misspelled security setting", () => {
    expect(() => sessionCookieSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: "flase" })).toThrow();
  });
});
