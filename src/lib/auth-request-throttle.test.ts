import { afterEach, expect, it, vi } from "vitest";
import { takeAuthRequest } from "./auth-request-throttle";

afterEach(() => vi.useRealTimers());

it("limits mass registration from one trusted IP without blocking another", () => {
  for (let index = 0; index < 10; index++) expect(takeAuthRequest("register", "192.0.2.100")).toBe(true);
  expect(takeAuthRequest("register", "192.0.2.100")).toBe(false);
  expect(takeAuthRequest("register", "192.0.2.101")).toBe(true);
});

it("limits repeated verification requests and lets a window expire", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
  for (let index = 0; index < 20; index++) expect(takeAuthRequest("resend", "192.0.2.110")).toBe(true);
  expect(takeAuthRequest("resend", "192.0.2.110")).toBe(false);
  vi.advanceTimersByTime(15 * 60 * 1000 + 1);
  expect(takeAuthRequest("resend", "192.0.2.110")).toBe(true);
});
