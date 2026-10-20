"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { effectiveRole } from "@/lib/permissions";
import { getSessionUser, createSession } from "@/server/session";
import {
  issueInvitation, registerWithEmail, requestEmailLink, requestPasswordReset, resendVerification,
  resetPassword, verifyEmailToken,
} from "@/server/auth-service";

export type AccountState = { error?: string; message?: string };

export async function createInvitationAction(_state: AccountState, form: FormData): Promise<AccountState> {
  const user = await getSessionUser();
  if (!user || effectiveRole(user) !== "OWNER") return { error: "Недостатньо прав." };
  const result = await issueInvitation(user.id, String(form.get("email") ?? ""));
  return result.ok ? { message: `Запрошення для ${result.email}: ${result.code}` } : { error: result.error };
}

export async function registerAction(_state: AccountState, form: FormData): Promise<AccountState> {
  const result = await registerWithEmail({
    invitationCode: String(form.get("invitation") ?? ""),
    email: String(form.get("email") ?? ""),
    firstName: String(form.get("firstName") ?? ""),
    nickname: String(form.get("nickname") ?? ""),
    password: String(form.get("password") ?? ""),
  });
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function resendVerificationAction(_state: AccountState, form: FormData): Promise<AccountState> {
  try { await resendVerification(String(form.get("email") ?? "")); } catch { /* Identical response avoids account enumeration. */ }
  return { message: "Якщо адреса очікує підтвердження, ми надіслали лист." };
}

export async function verifyEmailAction(form: FormData) {
  const actor = await getSessionUser();
  let verified;
  try { verified = await verifyEmailToken(String(form.get("token") ?? ""), actor?.id); }
  catch { redirect("/verify-email?invalid=1"); }
  if (!verified) redirect("/verify-email?invalid=1");
  if (verified.purpose === "LINK_EMAIL") { revalidatePath("/settings"); redirect("/settings?email=verified"); }
  await createSession(verified.userId, true);
  redirect("/onboarding");
}

export async function linkEmailAction(_state: AccountState, form: FormData): Promise<AccountState> {
  const user = await getSessionUser();
  if (!user) return { error: "Увійдіть до профілю." };
  return requestEmailLink(user.id, String(form.get("email") ?? ""));
}

export async function updateProfileAction(_state: AccountState, form: FormData): Promise<AccountState> {
  const user = await getSessionUser();
  if (!user?.onboarded) return { error: "Увійдіть до профілю." };
  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const examYear = Number(form.get("examYear"));
  if (firstName.length < 2 || firstName.length > 60 || lastName.length > 60 || !Number.isInteger(examYear) || examYear < 2026 || examYear > 2100) {
    return { error: "Перевірте ім’я, прізвище та рік НМТ." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { firstName, lastName, examYear } });
  revalidatePath("/settings");
  return { message: "Профіль збережено." };
}

export async function requestResetAction(_state: AccountState, form: FormData): Promise<AccountState> {
  try { await requestPasswordReset(String(form.get("email") ?? "")); } catch { /* Identical response avoids account enumeration. */ }
  return { message: "Якщо для адреси доступне відновлення, ми надіслали лист." };
}

export async function resetPasswordAction(_state: AccountState, form: FormData): Promise<AccountState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password !== confirm) return { error: "Паролі не збігаються." };
  if (password.length < 8) return { error: "Пароль має містити щонайменше 8 символів." };
  const ok = await resetPassword(String(form.get("token") ?? ""), password);
  if (!ok) return { error: "Посилання недійсне або термін його дії завершився." };
  redirect("/login?reset=1");
}
