const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function isLocalhostHttpUrl(raw: string | undefined) {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** True only when auth mail is redirected to the local QA sink (never on public HTTPS bases). */
export function isQaMailSinkEnabled() {
  const endpoint = process.env.AUTH_MAIL_QA_ENDPOINT;
  if (!endpoint) return false;
  if (!isLocalhostHttpUrl(process.env.AUTH_BASE_URL)) return false;
  try {
    const target = new URL(endpoint);
    if (target.pathname !== "/api/internal/qa-mail") return false;
    if (target.protocol !== "http:") return false;
    if (!LOCAL_HOSTS.has(target.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
