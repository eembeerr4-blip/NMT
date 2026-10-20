import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPasswordAsync } from "@/lib/auth";
import { isValidNickname, normalizeNickname } from "@/lib/nickname";
import { newSecret, normalizeEmail, secretHash, validEmail } from "@/lib/account-auth";
import { mailConfigured, sendAuthEmail } from "@/server/auth-mail";

const VERIFY_TTL = 24 * 60 * 60 * 1000;
const RESET_TTL = 30 * 60 * 1000;
type Tx = Prisma.TransactionClient;

export async function issueInvitation(ownerId: string, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!validEmail(email)) return { ok: false as const, error: "Перевірте email." };
  const code = randomBytes(24).toString("base64url");
  await prisma.invitation.create({ data: {
    codeHash: secretHash(code), email, createdById: ownerId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  } });
  return { ok: true as const, code, email };
}

export async function validInvitation(code: string, email: string) {
  if (!code || !validEmail(normalizeEmail(email))) return null;
  const invitation = await prisma.invitation.findUnique({ where: { codeHash: secretHash(code) } });
  if (!invitation || invitation.consumedAt || invitation.expiresAt <= new Date() || invitation.email !== normalizeEmail(email)) return null;
  return invitation;
}

async function consumeInvitation(tx: Tx, invitationId: string, userId: string) {
  const result = await tx.invitation.updateMany({
    where: { id: invitationId, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date(), consumedById: userId },
  });
  if (result.count !== 1) throw new Error("INVITATION_USED");
}

export async function registerWithEmail(input: {
  invitationCode: string; email: string; firstName: string; nickname: string; password: string;
}) {
  const email = normalizeEmail(input.email);
  const nickname = normalizeNickname(input.nickname);
  if (!mailConfigured()) return { ok: false as const, error: "Реєстрація тимчасово недоступна: пошту не налаштовано." };
  if (!validEmail(email) || input.firstName.trim().length < 2 || !isValidNickname(nickname) || input.password.length < 8) {
    return { ok: false as const, error: "Перевірте email, ім’я, нікнейм і пароль (від 8 символів)." };
  }
  const invitation = await validInvitation(input.invitationCode, email);
  if (!invitation) return { ok: false as const, error: "Запрошення недійсне, прострочене або призначене іншій адресі." };
  const token = newSecret();
  const passwordHash = await hashPasswordAsync(input.password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: {
        email, firstName: input.firstName.trim(), nickname, passwordHash, role: "STUDENT", onboarded: false,
      } });
      await consumeInvitation(tx, invitation.id, user.id);
      await tx.authToken.create({ data: {
        userId: user.id, purpose: "VERIFY_EMAIL", tokenHash: secretHash(token),
        expiresAt: new Date(Date.now() + VERIFY_TTL),
      } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, error: "Email або нікнейм уже використовується." };
    }
    if (error instanceof Error && error.message === "INVITATION_USED") return { ok: false as const, error: "Запрошення вже використано." };
    throw error;
  }
  try {
    await sendAuthEmail(email, "Підтвердження email NMT Academy", `/verify-email?token=${encodeURIComponent(token)}`);
    return { ok: true as const, message: "Перевірте пошту та підтвердьте адресу." };
  } catch {
    return { ok: true as const, message: "Профіль створено, але лист не надіслано. Скористайтеся повторним надсиланням." };
  }
}

export async function resendVerification(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!mailConfigured() || !validEmail(email)) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return;
  const recent = await prisma.authToken.count({ where: {
    userId: user.id, purpose: "VERIFY_EMAIL", createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
  } });
  if (recent >= 3) return;
  const token = newSecret();
  await prisma.authToken.create({ data: {
    userId: user.id, purpose: "VERIFY_EMAIL", tokenHash: secretHash(token),
    expiresAt: new Date(Date.now() + VERIFY_TTL),
  } });
  await sendAuthEmail(email, "Підтвердження email NMT Academy", `/verify-email?token=${encodeURIComponent(token)}`);
}

export async function requestEmailLink(userId: string, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!mailConfigured()) return { ok: false as const, error: "Пошту ще не налаштовано." };
  if (!validEmail(email)) return { ok: false as const, error: "Перевірте email." };
  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner && owner.id !== userId) return { ok: false as const, error: "Ця адреса вже використовується." };
  if (owner?.emailVerifiedAt) return { ok: true as const, message: "Цю адресу вже підтверджено." };
  const recent = await prisma.authToken.count({ where: {
    userId, purpose: "LINK_EMAIL", createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
  } });
  if (recent >= 3) return { ok: false as const, error: "Забагато запитів. Спробуйте пізніше." };
  const token = newSecret();
  await prisma.authToken.create({ data: {
    userId, purpose: "LINK_EMAIL", targetEmail: email, tokenHash: secretHash(token),
    expiresAt: new Date(Date.now() + VERIFY_TTL),
  } });
  try {
    await sendAuthEmail(email, "Прив’язка email NMT Academy", `/verify-email?token=${encodeURIComponent(token)}`);
    return { ok: true as const, message: "Перевірте пошту та підтвердьте нову адресу." };
  } catch {
    return { ok: false as const, error: "Лист не надіслано. Спробуйте пізніше." };
  }
}

export async function verifyEmailToken(token: string, actorId?: string) {
  if (!token || token.length > 256) return null;
  return prisma.$transaction(async (tx) => {
    const record = await tx.authToken.findUnique({ where: { tokenHash: secretHash(token) } });
    if (!record || !["VERIFY_EMAIL", "LINK_EMAIL"].includes(record.purpose) || record.consumedAt || record.expiresAt <= new Date()) return null;
    if (record.purpose === "LINK_EMAIL" && (!actorId || record.userId !== actorId || !record.targetEmail)) return null;
    const consumed = await tx.authToken.updateMany({ where: {
      id: record.id, consumedAt: null, expiresAt: { gt: new Date() },
    }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) return null;
    await tx.user.update({ where: { id: record.userId }, data: {
      ...(record.purpose === "LINK_EMAIL" ? { email: record.targetEmail } : {}),
      emailVerifiedAt: new Date(),
    } });
    await tx.authToken.deleteMany({ where: { userId: record.userId, purpose: record.purpose, consumedAt: null } });
    return { userId: record.userId, purpose: record.purpose };
  });
}

export async function requestPasswordReset(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!mailConfigured() || !validEmail(email)) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.emailVerifiedAt || !user.passwordHash) return;
  const recent = await prisma.authToken.count({ where: {
    userId: user.id, purpose: "RESET_PASSWORD", createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
  } });
  if (recent >= 3) return;
  const token = newSecret();
  await prisma.authToken.create({ data: {
    userId: user.id, purpose: "RESET_PASSWORD", tokenHash: secretHash(token),
    expiresAt: new Date(Date.now() + RESET_TTL),
  } });
  await sendAuthEmail(email, "Відновлення пароля NMT Academy", `/reset-password?token=${encodeURIComponent(token)}`);
}

export async function resetPassword(token: string, password: string) {
  if (!token || token.length > 256 || password.length < 8 || password.length > 1024) return false;
  const passwordHash = await hashPasswordAsync(password);
  return prisma.$transaction(async (tx) => {
    const record = await tx.authToken.findUnique({ where: { tokenHash: secretHash(token) } });
    if (!record || record.purpose !== "RESET_PASSWORD" || record.consumedAt || record.expiresAt <= new Date()) return false;
    const consumed = await tx.authToken.updateMany({ where: {
      id: record.id, consumedAt: null, expiresAt: { gt: new Date() },
    }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: record.userId } });
    await tx.authToken.deleteMany({ where: { userId: record.userId, purpose: "RESET_PASSWORD", consumedAt: null } });
    return true;
  });
}

export async function consumeInvitationForGoogle(tx: Tx, invitationId: string, userId: string) {
  return consumeInvitation(tx, invitationId, userId);
}
