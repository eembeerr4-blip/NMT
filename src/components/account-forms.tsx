"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import Link from "next/link";
import {
  type AccountState, createInvitationAction, linkEmailAction, registerAction, requestResetAction,
  resendVerificationAction, resetPasswordAction,
  updateProfileAction,
} from "@/server/account-actions";

function Feedback({ state }: { state: AccountState }) {
  if (state.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state.message) return <p role="status" className="break-all text-sm text-foreground">{state.message}</p>;
  return null;
}

export function RegistrationForm() {
  const [state, action, pending] = useActionState(registerAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [validationError, setValidationError] = useState("");
  if (state.registeredEmail) return <div className="space-y-3">
    <h2 className="text-lg font-semibold">Перевірте пошту</h2>
    <p role="status" className="text-sm">{state.message}</p>
    <p className="text-sm text-muted-foreground">Якщо лист надійшов, відкрийте його та натисніть «Підтвердити email». Якщо ви вже маєте акаунт, увійдіть або відновіть пароль.</p>
    <p className="break-all text-sm text-muted-foreground">Адреса для підтвердження: {state.registeredEmail}.</p>
    <ResendVerificationLink email={state.registeredEmail} />
    <Link href="/login" className="block text-sm underline">Увійти</Link>
    <Link href="/forgot-password" className="block text-sm underline">Забули пароль?</Link>
  </div>;
  return <><form action={action} className="space-y-3" onSubmit={(event) => {
    const values = new FormData(event.currentTarget);
    if (values.get("password") !== values.get("confirmPassword")) {
      event.preventDefault();
      setValidationError("Паролі не збігаються.");
    } else setValidationError("");
  }}>
    <label className="grid gap-1 text-sm">Нікнейм<Input name="nickname" required minLength={3} maxLength={24} pattern={"[A-Za-z0-9_\\-]{3,24}"} autoComplete="username" /></label>
    <label className="grid gap-1 text-sm">Електронна пошта<Input name="email" type="email" required autoComplete="email" /></label>
    <div className="grid gap-1 text-sm"><label htmlFor="register-password">Пароль</label><div className="flex min-w-0 gap-2">
      <Input id="register-password" name="password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={1024} autoComplete="new-password" className="min-w-0 flex-1" />
      <Button type="button" variant="outline" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Приховати пароль" : "Показати пароль"}>{showPassword ? "Приховати" : "Показати"}</Button>
    </div></div>
    <div className="grid gap-1 text-sm"><label htmlFor="register-confirm">Підтвердження пароля</label><div className="flex min-w-0 gap-2">
      <Input id="register-confirm" name="confirmPassword" type={showConfirmation ? "text" : "password"} required minLength={8} maxLength={1024} autoComplete="new-password" className="min-w-0 flex-1" />
      <Button type="button" variant="outline" onClick={() => setShowConfirmation(!showConfirmation)} aria-label={showConfirmation ? "Приховати підтвердження пароля" : "Показати підтвердження пароля"}>{showConfirmation ? "Приховати" : "Показати"}</Button>
    </div></div>
    {validationError ? <p role="alert" className="text-sm text-destructive">{validationError}</p> : null}
    <Feedback state={state} />
    <Button type="submit" disabled={pending}>{pending ? "Реєстрація…" : "Зареєструватися"}</Button>
  </form>
  </>;
}

export function ResendVerificationLink({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerificationAction, {});
  return <form action={action} className="space-y-2">
    <input type="hidden" name="email" value={email} />
    <Feedback state={state} />
    <button type="submit" disabled={pending} className="text-sm font-medium text-primary underline disabled:opacity-50">Надіслати лист повторно</button>
  </form>;
}

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationAction, {});
  return <form action={action} className="space-y-2">
    <label className="grid gap-1 text-sm">Повторно надіслати підтвердження<Input name="email" type="email" required autoComplete="email" /></label>
    <Feedback state={state} />
    <Button type="submit" variant="outline" disabled={pending}>Надіслати</Button>
  </form>;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestResetAction, {});
  return <form action={action} className="space-y-3">
    <label className="grid gap-1 text-sm">Email<Input name="email" type="email" required autoComplete="email" /></label>
    <Feedback state={state} />
    <Button type="submit" disabled={pending}>{pending ? "Надсилання…" : "Надіслати посилання"}</Button>
  </form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="token" value={token} />
    <label className="grid gap-1 text-sm">Новий пароль<Input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    <label className="grid gap-1 text-sm">Повторіть пароль<Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
    <Feedback state={state} />
    <Button type="submit" disabled={pending}>{pending ? "Збереження…" : "Змінити пароль"}</Button>
  </form>;
}

export function InvitationForm() {
  const [state, action, pending] = useActionState(createInvitationAction, {});
  return <form action={action} className="space-y-3">
    <label className="grid gap-1 text-sm">Email учня<Input name="email" type="email" required /></label>
    <p className="text-xs text-muted-foreground">Код діє 7 днів і може бути використаний лише один раз для цієї адреси. Скопіюйте його одразу.</p>
    <Feedback state={state} />
    <Button type="submit" disabled={pending}>Створити запрошення</Button>
  </form>;
}

export function EmailLinkForm({ currentEmail }: { currentEmail: string | null }) {
  const [state, action, pending] = useActionState(linkEmailAction, {});
  const label = currentEmail ? "Змінити підтверджений email" : "Додати email для відновлення пароля";
  return <form action={action} className="space-y-3">
    <div className="grid gap-1.5">
      <Label htmlFor="settings-recovery-email">{label}</Label>
      <Input id="settings-recovery-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
    </div>
    <Feedback state={state} />
    <Button type="submit" disabled={pending}>{pending ? "Надсилання…" : "Надіслати підтвердження"}</Button>
  </form>;
}

export function ProfileEditForm({ firstName, lastName, examYear }: { firstName: string; lastName: string; examYear: number }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <label className="grid gap-1 text-sm">Ім’я<Input name="firstName" defaultValue={firstName} required minLength={2} maxLength={60} /></label>
    <label className="grid gap-1 text-sm">Прізвище<Input name="lastName" defaultValue={lastName} maxLength={60} /></label>
    <input type="hidden" name="examYear" value={examYear} />
    <div className="sm:col-span-2"><Feedback state={state} /><Button type="submit" disabled={pending}>Зберегти профіль</Button></div>
  </form>;
}
