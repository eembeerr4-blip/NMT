import { cache } from "react";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessionCookieSecure } from "@/lib/session-cookie";
import { accountStatus, canAccessLearning } from "@/lib/account-status";
import { isAdministrator, canEditContent, isOwner } from "@/lib/permissions";

const COOKIE = "nmt_user";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, rememberMe = false) {
  const ttlMs = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 8;
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: sessionCookieSecure(),
    maxAge: rememberMe ? Math.floor(ttlMs / 1000) : undefined,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}

export const getSessionUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { omit: { passwordHash: true }, include: { subjects: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireAuthenticated() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

function redirectForAccountStatus(user: { id: string; accountStatus?: string | null }) {
  const status = accountStatus(user);
  if (status === "REJECTED") redirect("/login?rejected=1");
  if (status === "PENDING") redirect("/pending");
}

export async function requireUser() {
  const user = await requireAuthenticated();
  redirectForAccountStatus(user);
  if (!user.onboarded && !isAdministrator(user) && !canEditContent(user)) redirect("/onboarding");
  return user;
}

export async function requireApprovedAccount() {
  const user = await requireAuthenticated();
  redirectForAccountStatus(user);
  return user;
}

export async function requireOwner() {
  const user = await requireAuthenticated();
  if (!isOwner(user)) notFound();
  return user;
}

export async function requireAdministrator() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdministrator(user)) notFound();
  return user;
}

export function sameUser(userId: string, ownerId: string | null | undefined) {
  return Boolean(ownerId) && ownerId === userId;
}

export async function requireContentEditor() {
  const user = await requireAuthenticated();
  redirectForAccountStatus(user);
  if (!canEditContent(user)) notFound();
  if (!user.onboarded && !isAdministrator(user)) redirect("/onboarding");
  return user;
}

export function assertLearningAccess(user: { id: string; accountStatus?: string | null; role?: string; onboarded?: boolean }) {
  if (canAccessLearning(user) || isAdministrator(user) || canEditContent(user)) return;
  if (accountStatus(user) === "PENDING") throw new Error("PENDING_ACCOUNT");
  if (accountStatus(user) === "REJECTED") throw new Error("REJECTED_ACCOUNT");
}
