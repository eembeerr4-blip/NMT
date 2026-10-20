import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const sent = vi.hoisted(() => [] as { to: string; path: string }[]);
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth-mail", () => ({
  mailConfigured: () => true,
  sendAuthEmail: async (to: string, _subject: string, link: string) => { sent.push({ to, path: link }); },
}));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-stage01-auth-"));
  const database = path.join(folder, "auth.db");
  return { prisma: new PrismaClient({ datasourceUrl: `file:${database.replaceAll("\\", "/")}` }), folder, database };
});

import { prisma } from "@/lib/prisma";
import { hashPasswordAsync, verifyPasswordAsync } from "@/lib/auth";
import {
  issueInvitation, registerWithEmail, requestPasswordReset, resetPassword,
  requestEmailLink, resendVerification, validInvitation, verifyEmailToken,
} from "@/server/auth-service";

beforeAll(async () => {
  const { database } = await import("@/lib/prisma") as unknown as { database: string };
  writeFileSync(database, "");
  execFileSync(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${database.replaceAll("\\", "/")}` }, stdio: "pipe", timeout: 60000,
  });
  await prisma.user.create({ data: {
    id: "owner", role: "OWNER", firstName: "Owner", nickname: "owner", onboarded: true,
    passwordHash: await hashPasswordAsync("owner-test-password"),
  } });
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  const { folder, database } = await import("@/lib/prisma") as unknown as { folder: string; database: string };
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(database + suffix)) unlinkSync(database + suffix);
  rmdirSync(folder);
});

it("registers without an invitation, retains old invitations, and enforces email uniqueness", async () => {
  const invitation = await issueInvitation("owner", " Student@Example.com ");
  expect(invitation.ok).toBe(true);
  if (!invitation.ok) return;
  expect((await validInvitation(invitation.code, "STUDENT@example.com"))?.email).toBe("student@example.com");
  const created = await registerWithEmail({
    email: "STUDENT@example.com", nickname: "student_one", password: "correct-horse-123", confirmPassword: "correct-horse-123",
  });
  expect(created.ok).toBe(true);
  expect((await registerWithEmail({ email: "student@example.com", nickname: "student_two", password: "correct-horse-123", confirmPassword: "correct-horse-123" })).ok).toBe(false);
  expect((await registerWithEmail({ email: "other@example.com", nickname: "STUDENT_ONE", password: "correct-horse-123", confirmPassword: "correct-horse-123" })).ok).toBe(false);
  expect(await validInvitation(invitation.code, "student@example.com")).not.toBeNull();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "student@example.com" } });
  expect(user.role).toBe("STUDENT");
  expect(user.emailVerifiedAt).toBeNull();
  expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  await expect(prisma.user.create({ data: { firstName: "Duplicate", nickname: "student_three", email: "STUDENT@EXAMPLE.COM" } })).rejects.toMatchObject({ code: "P2002" });
});

it("rejects mismatched passwords on the server without creating a user", async () => {
  const result = await registerWithEmail({ email: "mismatch@example.com", nickname: "mismatch", password: "correct-horse-123", confirmPassword: "different-password" });
  expect(result).toEqual({ ok: false, error: "Паролі не збігаються." });
  expect(await prisma.user.findUnique({ where: { email: "mismatch@example.com" } })).toBeNull();
});

it("resends verification without revealing whether an address exists", async () => {
  const before = sent.length;
  await resendVerification("STUDENT@EXAMPLE.COM");
  await resendVerification("unknown@example.com");
  expect(sent.slice(before)).toHaveLength(1);
  expect(sent.at(-1)?.to).toBe("student@example.com");
});

it("confirms email once, resets password once, and revokes prior sessions", async () => {
  const emailLink = sent.find((item) => item.to === "student@example.com" && item.path.startsWith("/verify-email?"));
  expect(emailLink).toBeDefined();
  const verification = new URL(emailLink!.path, "https://qa.invalid").searchParams.get("token")!;
  const verified = await verifyEmailToken(verification);
  const userId = verified?.userId;
  expect(verified?.purpose).toBe("VERIFY_EMAIL");
  expect(await verifyEmailToken(verification)).toBeNull();
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId! } });
  expect(before.emailVerifiedAt).not.toBeNull();
  await prisma.session.create({ data: { userId: userId!, tokenHash: "old-session", expiresAt: new Date(Date.now() + 100000) } });
  await requestPasswordReset("STUDENT@EXAMPLE.COM");
  const resetLink = sent.find((item) => item.path.startsWith("/reset-password?"));
  expect(resetLink).toBeDefined();
  const resetToken = new URL(resetLink!.path, "https://qa.invalid").searchParams.get("token")!;
  expect(await resetPassword(resetToken, "new-password-456")).toBe(true);
  expect(await resetPassword(resetToken, "another-password-789")).toBe(false);
  expect(await prisma.session.count({ where: { userId: userId! } })).toBe(0);
  const after = await prisma.user.findUniqueOrThrow({ where: { id: userId! } });
  expect(await verifyPasswordAsync("new-password-456", after.passwordHash)).toBe(true);
  expect(after.role).toBe("STUDENT");
  expect((await prisma.user.findUniqueOrThrow({ where: { id: "owner" } })).role).toBe("OWNER");
});

it("returns the same result for unknown and known unverified reset requests", async () => {
  const count = sent.length;
  await requestPasswordReset("missing@example.com");
  expect(sent).toHaveLength(count);
});

it("links email to an existing account only with its session and preserves role", async () => {
  const result = await requestEmailLink("owner", "Owner-New@Example.com");
  expect(result.ok).toBe(true);
  const link = sent.find((item) => item.to === "owner-new@example.com");
  expect(link).toBeDefined();
  const token = new URL(link!.path, "https://qa.invalid").searchParams.get("token")!;
  expect(await verifyEmailToken(token, "someone-else")).toBeNull();
  expect(await verifyEmailToken(token, "owner")).toEqual({ userId: "owner", purpose: "LINK_EMAIL" });
  expect(await verifyEmailToken(token, "owner")).toBeNull();
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: "owner" } });
  expect(owner.email).toBe("owner-new@example.com");
  expect(owner.emailVerifiedAt).not.toBeNull();
  expect(owner.role).toBe("OWNER");
});
