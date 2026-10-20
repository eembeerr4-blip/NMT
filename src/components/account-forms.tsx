"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
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
  return <form action={action} className="space-y-3">
    <label className="grid gap-1 text-sm">Код запрошення<Input name="invitation" required autoComplete="off" /></label>
    <label className="grid gap-1 text-sm">Нікнейм<Input name="nickname" required minLength={3} maxLength={24} pattern={"[A-Za-z0-9_\\-]{3,24}"} autoComplete="username" /></label>
    <label className="grid gap-1 text-sm">Електронна пошта<Input name="email" type="email" required autoComplete="email" /></label>
    <label className="grid gap-1 text-sm">Пароль для акаунта<Input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    <p className="text-xs text-muted-foreground">Це пароль від NMT Academy, а не від вашої електронної пошти. Ім’я для звертання можна змінити в налаштуваннях профілю.</p>
    <Feedback state={state} />
    <Button type="submit" disabled={pending}>{pending ? "Реєстрація…" : "Зареєструватися"}</Button>
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
  return <form action={action} className="space-y-2">
    <label className="grid gap-1 text-sm">{currentEmail ? "Змінити підтверджений email" : "Додати email для відновлення пароля"}
      <Input name="email" type="email" required autoComplete="email" />
    </label>
    <Feedback state={state} />
    <Button type="submit" variant="outline" disabled={pending}>Надіслати підтвердження</Button>
  </form>;
}

export function ProfileEditForm({ firstName, lastName, examYear }: { firstName: string; lastName: string; examYear: number }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-3">
    <label className="grid gap-1 text-sm">Ім’я<Input name="firstName" defaultValue={firstName} required minLength={2} maxLength={60} /></label>
    <label className="grid gap-1 text-sm">Прізвище<Input name="lastName" defaultValue={lastName} maxLength={60} /></label>
    <label className="grid gap-1 text-sm">Рік НМТ<Input name="examYear" type="number" defaultValue={examYear} required min={2026} max={2100} /></label>
    <div className="sm:col-span-3"><Feedback state={state} /><Button type="submit" disabled={pending}>Зберегти профіль</Button></div>
  </form>;
}
