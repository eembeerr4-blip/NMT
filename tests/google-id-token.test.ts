import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/auth-mail", () => ({ authBaseUrl: () => "http://localhost:3101" }));
vi.mock("@/server/auth-service", () => ({ validInvitation: vi.fn(), consumeInvitationForGoogle: vi.fn() }));

import { verifyGoogleIdToken } from "@/server/google-oauth";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: "jwk" }), kid: "qa-key", use: "sig" };
const originalClientId = process.env.GOOGLE_CLIENT_ID;
const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

function token(changes: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "qa-key" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com", aud: "qa-client", sub: "google-subject-1",
    email: "Student@Example.com", email_verified: true, given_name: "Student",
    nonce: "expected-nonce", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    ...changes,
  })).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), pair.privateKey).toString("base64url");
  return `${header}.${claims}.${signature}`;
}

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "qa-client";
  process.env.GOOGLE_CLIENT_SECRET = "qa-secret";
  vi.stubGlobal("fetch", async () => Response.json({ keys: [jwk] }));
});
afterAll(() => {
  if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = originalClientId;
  if (originalSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
  vi.unstubAllGlobals();
});

it("accepts a signed Google identity and normalizes the verified email", async () => {
  expect(await verifyGoogleIdToken(token(), "expected-nonce")).toEqual({
    sub: "google-subject-1", email: "student@example.com", givenName: "Student",
  });
});

it("rejects forged signatures, wrong audience, wrong nonce and unverified email", async () => {
  const parts = token().split(".");
  const corrupted = Buffer.from(parts[2], "base64url");
  corrupted[0] ^= 0xff;
  await expect(verifyGoogleIdToken(`${parts[0]}.${parts[1]}.${corrupted.toString("base64url")}`, "expected-nonce")).rejects.toThrow();
  await expect(verifyGoogleIdToken(token({ aud: "another-client" }), "expected-nonce")).rejects.toThrow();
  await expect(verifyGoogleIdToken(token(), "another-nonce")).rejects.toThrow();
  await expect(verifyGoogleIdToken(token({ email_verified: false }), "expected-nonce")).rejects.toThrow();
});
