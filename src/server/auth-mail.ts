import "server-only";

const RESEND_URL = "https://api.resend.com/emails";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character] ?? character);

export class AuthEmailError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthEmailError";
    this.status = status;
  }
}

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

export async function sendAuthEmail(
  to: string,
  subject: string,
  path: string,
  options?: { validityMinutes?: number; actionLabel?: string },
) {
  if (!mailConfigured()) throw new Error("Email provider is not configured");
  const href = new URL(path, authBaseUrl()).toString();
  const validity = options?.validityMinutes === 1440 ? "24 години" : `${options?.validityMinutes} хвилин`;
  const validityLine = options?.validityMinutes
    ? `\n\nПосилання дійсне ${validity}.`
    : "";
  const label = options?.actionLabel ?? "Відкрити посилання";
  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;font:16px/1.5 Arial,sans-serif;color:#172033">
    <h1 style="font-size:22px">${escapeHtml(subject)}</h1>
    <p>Ви отримали цей лист для NMT Academy.</p>
    <p><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#2755c9;color:#fff;text-decoration:none">${escapeHtml(label)}</a></p>
    <p>Якщо кнопка не працює, відкрийте посилання: <a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>
    ${options?.validityMinutes ? `<p>Посилання дійсне ${validity}.</p>` : ""}
    <p>Якщо ви не робили цей запит, просто ігноруйте лист.</p>
  </div>`;
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
      text: `${subject}\n\nВідкрийте посилання: ${href}${validityLine}\n\nЯкщо ви не робили цей запит, просто ігноруйте лист.`,
      html,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new AuthEmailError(response.status, `Email provider rejected request (${response.status})`);
}
