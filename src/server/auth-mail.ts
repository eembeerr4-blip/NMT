import "server-only";

const RESEND_URL = "https://api.resend.com/emails";

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM && process.env.AUTH_BASE_URL);
}

export function authBaseUrl() {
  const raw = process.env.AUTH_BASE_URL;
  if (!raw) throw new Error("AUTH_BASE_URL is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("AUTH_BASE_URL must use HTTPS outside localhost");
  }
  return url.origin;
}

export async function sendAuthEmail(to: string, subject: string, path: string) {
  if (!mailConfigured()) throw new Error("Email provider is not configured");
  const href = new URL(path, authBaseUrl()).toString();
  let endpoint = RESEND_URL;
  if (process.env.AUTH_MAIL_QA_ENDPOINT) {
    const target = new URL(process.env.AUTH_MAIL_QA_ENDPOINT);
    const app = new URL(authBaseUrl());
    if (!["localhost", "127.0.0.1"].includes(app.hostname) ||
        !["localhost", "127.0.0.1"].includes(target.hostname) || target.protocol !== "http:") {
      throw new Error("QA mail endpoint is allowed only on localhost");
    }
    endpoint = target.toString();
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [to],
      subject,
      text: `${subject}\n\nВідкрийте посилання: ${href}\n\nЯкщо ви не робили цей запит, просто ігноруйте лист.`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Email provider rejected request (${response.status})`);
}
