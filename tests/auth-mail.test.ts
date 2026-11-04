import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { sendAuthEmail } from "@/server/auth-mail";

it("includes password-reset validity in the email body", async () => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.AUTH_EMAIL_FROM = "NMT <test@example.com>";
  process.env.AUTH_BASE_URL = "http://localhost:3000";
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  await sendAuthEmail("user@example.com", "Відновлення пароля", "/reset-password?token=abc", { validityMinutes: 15 });
  const payload = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
  expect(payload.text).toContain("Посилання дійсне 15 хвилин.");
  expect(payload.html).toContain("Посилання дійсне 15 хвилин.");
  expect(payload.html).toContain('href="http://localhost:3000/reset-password?token=abc"');
});

it("does not redirect mail to QA sink when AUTH_BASE_URL is public HTTPS", async () => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.AUTH_EMAIL_FROM = "NMT <test@example.com>";
  process.env.AUTH_BASE_URL = "https://academy.example.com";
  process.env.AUTH_MAIL_QA_ENDPOINT = "http://127.0.0.1:3010/api/internal/qa-mail";
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  await sendAuthEmail("user@example.com", "Subject", "/verify-email?token=abc");
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("api.resend.com");
  delete process.env.AUTH_MAIL_QA_ENDPOINT;
});

it("renders a confirmation button and 24-hour expiry", async () => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.AUTH_EMAIL_FROM = "NMT <test@example.com>";
  process.env.AUTH_BASE_URL = "http://localhost:3000";
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  await sendAuthEmail("user@example.com", "Підтвердіть електронну пошту — NMT Academy", "/verify-email?token=abc", { validityMinutes: 1440, actionLabel: "Підтвердити email" });
  const payload = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
  expect(payload.text).toContain("Посилання дійсне 24 години.");
  expect(payload.html).toContain(">Підтвердити email</a>");
});
