import { afterEach, expect, it, vi } from "vitest";
import { clearAccountFailures, isLoginLimited, registerLoginFailure, trustedClientIp } from "./login-throttle";

afterEach(() => vi.useRealTimers());

it("locks one account after ten failures and clears it after a valid login", () => {
  for (let index = 0; index < 9; index++) registerLoginFailure("account-a", "192.0.2.1");
  expect(isLoginLimited("account-a", "192.0.2.1")).toBe(false);
  registerLoginFailure("account-a", "192.0.2.1");
  expect(isLoginLimited("account-a", "192.0.2.2")).toBe(true);
  clearAccountFailures("account-a");
  expect(isLoginLimited("account-a", "192.0.2.2")).toBe(false);
});

it("limits many different accounts from one trusted IP without blocking another IP", () => {
  for (let index = 0; index < 30; index++) registerLoginFailure(`spray-${index}`, "192.0.2.30");
  expect(isLoginLimited("fresh-account", "192.0.2.30")).toBe(true);
  expect(isLoginLimited("fresh-account", "192.0.2.31")).toBe(false);
});

it("expires temporary limits after fifteen minutes", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
  for (let index = 0; index < 10; index++) registerLoginFailure("expiring-account", "192.0.2.40");
  expect(isLoginLimited("expiring-account", "192.0.2.41")).toBe(true);
  vi.advanceTimersByTime(15 * 60 * 1000 + 1);
  expect(isLoginLimited("expiring-account", "192.0.2.41")).toBe(false);
});

it("ignores client IP headers without explicit trusted-proxy configuration", () => {
  const headers = new Headers({ "x-forwarded-for": "192.0.2.50", "x-nmt-client-ip": "192.0.2.51" });
  expect(trustedClientIp(headers, false)).toBeNull();
  expect(trustedClientIp(headers, true)).toBe("192.0.2.51");
  expect(trustedClientIp(new Headers({ "x-nmt-client-ip": "192.0.2.51, 192.0.2.52" }), true)).toBeNull();
});
