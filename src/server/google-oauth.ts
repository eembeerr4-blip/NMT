import "server-only";

import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { equalSecret, normalizeEmail, secretHash, validEmail } from "@/lib/account-auth";
import { takeAuthRequest } from "@/lib/auth-request-throttle";
import { trustedClientIp } from "@/lib/login-throttle";
import { sessionCookieSecure } from "@/lib/session-cookie";
import { authBaseUrl } from "@/server/auth-mail";
import { createSession, getSessionUser } from "@/server/session";

const STATE_COOKIE = "nmt_google_state";
const FLOW_TTL = 5 * 60 * 1000;
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  return { clientId, clientSecret, redirectUri: `${authBaseUrl()}/api/auth/google/callback` };
}

function base64UrlSha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export async function startGoogleAuth(form: FormData) {
  "use server";
  const mode = String(form.get("mode") ?? "login");
  if (!["login", "register", "link"].includes(mode)) redirect("/login?oauth=invalid");
  if (!takeAuthRequest("google", trustedClientIp(await headers()))) {
    redirect(mode === "register" ? "/register?oauth=rate_limited" : "/login?oauth=rate_limited");
  }
  const config = googleConfig();
  let linkUserId: string | null = null;
  if (mode === "link") {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    linkUserId = user.id;
  }
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  await prisma.oAuthFlow.create({ data: {
    stateHash: secretHash(state), nonce, codeVerifier, linkUserId,
    expiresAt: new Date(Date.now() + FLOW_TTL),
  } });
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true, secure: sessionCookieSecure(), sameSite: "lax", path: "/api/auth/google/callback", maxAge: 300,
  });
  const url = new URL(GOOGLE_AUTH);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
    scope: "openid email profile", state, nonce, code_challenge: base64UrlSha256(codeVerifier),
    code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  redirect(url.toString());
}

export type GoogleIdentity = { sub: string; email: string; givenName: string };

export async function verifyGoogleIdToken(idToken: string, expectedNonce: string): Promise<GoogleIdentity> {
  const { clientId } = googleConfig();
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid ID token");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { alg?: string; kid?: string };
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
    iss?: string; aud?: string; azp?: string; exp?: number; iat?: number; nonce?: string;
    sub?: string; email?: string; email_verified?: boolean | string; given_name?: string;
  };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid signing algorithm");
  const keysResponse = await fetch(GOOGLE_JWKS, { cache: "no-store" });
  if (!keysResponse.ok) throw new Error("Could not load Google signing keys");
  const jwks = await keysResponse.json() as { keys?: (JsonWebKey & { kid?: string; kty?: string; use?: string })[] };
  const key = jwks.keys?.find((item) => item.kid === header.kid && item.kty === "RSA" && item.use === "sig");
  if (!key || !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: key as unknown as import("node:crypto").JsonWebKey, format: "jwk" }), Buffer.from(parts[2], "base64url"))) {
    throw new Error("Invalid Google signature");
  }
  const now = Math.floor(Date.now() / 1000);
  if (!["https://accounts.google.com", "accounts.google.com"].includes(claims.iss ?? "") ||
    claims.aud !== clientId || (claims.azp && claims.azp !== clientId) ||
    !claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 60 ||
    !claims.nonce || !equalSecret(claims.nonce, expectedNonce) ||
    !claims.sub || claims.email_verified !== true || !validEmail(normalizeEmail(claims.email ?? ""))) {
    throw new Error("Invalid Google identity claims");
  }
  return { sub: claims.sub, email: normalizeEmail(claims.email!), givenName: claims.given_name?.trim() || "Учень" };
}

export async function finishGoogleAuth(code: string, state: string) {
  if (!code || !state || code.length > 4096 || state.length > 256) return "/login?oauth=invalid";
  const jar = await cookies();
  const cookieState = jar.get(STATE_COOKIE)?.value ?? "";
  jar.delete(STATE_COOKIE);
  if (!equalSecret(cookieState, state)) return "/login?oauth=invalid";
  const flow = await prisma.oAuthFlow.findUnique({ where: { stateHash: secretHash(state) } });
  if (!flow || flow.expiresAt <= new Date()) return "/login?oauth=expired";
  const consumed = await prisma.oAuthFlow.deleteMany({ where: { id: flow.id, stateHash: secretHash(state) } });
  if (consumed.count !== 1) return "/login?oauth=used";
  const config = googleConfig();
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store",
    body: new URLSearchParams({
      code, client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: flow.codeVerifier,
    }),
  });
  if (!response.ok) return "/login?oauth=exchange_failed";
  const tokenResponse = await response.json() as { id_token?: string };
  if (!tokenResponse.id_token) return "/login?oauth=invalid";
  const identity = await verifyGoogleIdToken(tokenResponse.id_token, flow.nonce);
  const linked = await prisma.oAuthAccount.findUnique({ where: {
    provider_providerSubject: { provider: "google", providerSubject: identity.sub },
  } });
  if (flow.linkUserId) {
    const actor = await getSessionUser();
    if (!actor || actor.id !== flow.linkUserId || (linked && linked.userId !== actor.id)) return "/settings?oauth=link_failed";
    const currentBinding = await prisma.oAuthAccount.findUnique({ where: { userId_provider: { userId: actor.id, provider: "google" } } });
    if (currentBinding && currentBinding.providerSubject !== identity.sub) return "/settings?oauth=link_failed";
    if (actor.email && normalizeEmail(actor.email) !== identity.email) return "/settings?oauth=email_mismatch";
    const emailOwner = await prisma.user.findUnique({ where: { email: identity.email } });
    if (emailOwner && emailOwner.id !== actor.id) return "/settings?oauth=email_in_use";
    try {
      await prisma.$transaction(async (tx) => {
        if (!currentBinding) await tx.oAuthAccount.create({ data: { userId: actor.id, provider: "google", providerSubject: identity.sub } });
        await tx.user.update({ where: { id: actor.id }, data: { email: identity.email, emailVerifiedAt: new Date() } });
      });
    } catch { return "/settings?oauth=link_failed"; }
    return "/settings?oauth=linked";
  }
  if (linked) {
    await createSession(linked.userId, true);
    const user = await prisma.user.findUnique({ where: { id: linked.userId } });
    return user?.onboarded ? "/" : "/onboarding";
  }
  if (await prisma.user.findUnique({ where: { email: identity.email } })) return "/login?oauth=link_required";
  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: {
        firstName: identity.givenName, nickname: `g${randomBytes(8).toString("hex")}`,
        email: identity.email, emailVerifiedAt: new Date(), role: "STUDENT", passwordHash: "", onboarded: false,
      } });
      await tx.oAuthAccount.create({ data: { userId: user.id, provider: "google", providerSubject: identity.sub } });
      return user.id;
    });
  } catch { return "/register?oauth=registration_failed"; }
  await createSession(userId, true);
  return "/onboarding";
}
