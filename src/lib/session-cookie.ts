type CookieEnvironment = {
  NODE_ENV?: string;
  SESSION_COOKIE_SECURE?: string;
};

export function sessionCookieSecure(env: CookieEnvironment = process.env) {
  if (env.SESSION_COOKIE_SECURE === "true") return true;
  if (env.SESSION_COOKIE_SECURE === "false") return false;
  if (env.SESSION_COOKIE_SECURE) throw new Error("SESSION_COOKIE_SECURE must be true or false");
  return env.NODE_ENV === "production";
}
