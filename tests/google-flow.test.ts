import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const controls = vi.hoisted(() => ({
  jar: new Map<string, string>(), actor: null as null | { id: string; email: string | null },
  nonce: "", sub: "", email: "", createdSessions: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => controls.jar.has(name) ? { value: controls.jar.get(name) } : undefined,
  set: (name: string, value: string) => { controls.jar.set(name, value); },
  delete: (name: string) => { controls.jar.delete(name); },
}), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/server/session", () => ({
  getSessionUser: async () => controls.actor,
  createSession: async (id: string) => { controls.createdSessions.push(id); },
}));
vi.mock("@/server/auth-mail", () => ({ authBaseUrl: () => "http://localhost:3101", mailConfigured: () => true, sendAuthEmail: vi.fn() }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-google-flow-"));
  const database = path.join(folder, "oauth.db");
  return { prisma: new PrismaClient({ datasourceUrl: `file:${database.replaceAll("\\", "/")}` }), folder, database };
});

import { prisma } from "@/lib/prisma";
import { issueInvitation } from "@/server/auth-service";
import { finishGoogleAuth, startGoogleAuth } from "@/server/google-oauth";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: "jwk" }), kid: "qa-key", use: "sig" };
const previousId = process.env.GOOGLE_CLIENT_ID;
const previousSecret = process.env.GOOGLE_CLIENT_SECRET;

function fakeGoogleToken() {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "qa-key" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com", aud: "qa-client", sub: controls.sub,
    email: controls.email, email_verified: true, given_name: "Google",
    nonce: controls.nonce, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), pair.privateKey).toString("base64url");
  return `${header}.${claims}.${signature}`;
}

async function begin(mode: "login" | "register" | "link", invitation = "", email = "") {
  const form = new FormData();
  form.set("mode", mode); form.set("invitation", invitation); form.set("email", email);
  await expect(startGoogleAuth(form)).rejects.toThrow(/^REDIRECT:https:\/\/accounts\.google\.com/);
  const flow = await prisma.oAuthFlow.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  controls.nonce = flow.nonce;
  return controls.jar.get("nmt_google_state")!;
}

beforeAll(async () => {
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  writeFileSync(database, "");
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${database.replaceAll("\\", "/")}` }, stdio: "pipe", timeout: 60000,
  });
  process.env.GOOGLE_CLIENT_ID = "qa-client";
  process.env.GOOGLE_CLIENT_SECRET = "qa-secret";
  vi.stubGlobal("fetch", async (url: string) => {
    if (String(url).includes("/certs")) return Response.json({ keys: [jwk] });
    if (String(url).includes("/token")) return Response.json({ id_token: fakeGoogleToken() });
    throw new Error("Unexpected URL");
  });
  await prisma.user.create({ data: {
    id: "owner", role: "OWNER", firstName: "Owner", nickname: "owner", onboarded: true,
    email: "owner@example.com", emailVerifiedAt: new Date(), passwordHash: "existing-hash",
  } });
  await prisma.user.create({ data: {
    id: "admin-existing", role: "ADMIN", firstName: "Admin", nickname: "admin_existing", onboarded: true,
    email: "admin@example.com", emailVerifiedAt: new Date(), passwordHash: "existing-hash",
  } });
}, 60000);

afterAll(async () => {
  vi.unstubAllGlobals();
  if (previousId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previousId;
  if (previousSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = previousSecret;
  await prisma.$disconnect();
  const { folder, database } = await import("@/lib/prisma") as unknown as { folder: string; database: string };
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(database + suffix)) unlinkSync(database + suffix);
  rmdirSync(folder);
});

it("creates a new STUDENT through Google without an invitation", async () => {
  controls.sub = "new-google-subject"; controls.email = "new@example.com";
  const state = await begin("register");
  expect(await finishGoogleAuth("qa-code", state)).toBe("/onboarding");
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "new@example.com" } });
  expect(user.role).toBe("STUDENT");
  expect(user.emailVerifiedAt).not.toBeNull();
  expect(await finishGoogleAuth("qa-code", state)).toMatch(/invalid|used/);
});

it("retains old invitation records while Google login preserves existing roles", async () => {
  const invite = await issueInvitation("owner", "another@example.com");
  if (!invite.ok) throw new Error("Invitation failed");
  controls.sub = "another-google-subject"; controls.email = "another@example.com";
  const state = await begin("login");
  expect(await finishGoogleAuth("qa-code", state)).toBe("/onboarding");
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "another@example.com" } });
  expect(user.role).toBe("STUDENT");
  expect(user.passwordHash).toBe("");
  expect((await prisma.oAuthAccount.findMany({ where: { userId: user.id } })).map((item) => item.providerSubject)).toEqual(["another-google-subject"]);
  expect((await prisma.invitation.findFirstOrThrow({ where: { email: "another@example.com" } })).consumedAt).toBeNull();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: "owner" } })).role).toBe("OWNER");
});

it("does not auto-link Google to an existing email; explicit session link preserves ADMIN", async () => {
  controls.sub = "admin-google-subject"; controls.email = "admin@example.com";
  const state = await begin("register");
  expect(await finishGoogleAuth("qa-code", state)).toBe("/login?oauth=link_required");
  expect(await prisma.oAuthAccount.count({ where: { userId: "admin-existing" } })).toBe(0);
  controls.actor = { id: "admin-existing", email: "admin@example.com" };
  const linkState = await begin("link");
  expect(await finishGoogleAuth("qa-code", linkState)).toBe("/settings?oauth=linked");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: "admin-existing" } })).role).toBe("ADMIN");
  expect((await prisma.oAuthAccount.findUniqueOrThrow({ where: { provider_providerSubject: { provider: "google", providerSubject: "admin-google-subject" } } })).userId).toBe("admin-existing");
});
