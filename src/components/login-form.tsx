"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";

export type LoginState = { error: string } | null;

export function LoginForm({ action }: {
  action: (previousState: LoginState, formData: FormData) => Promise<LoginState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3" aria-busy={pending}>
      <label className="grid gap-1.5 text-sm font-medium">Нікнейм або email<Input name="nickname" placeholder="Нікнейм або email" aria-label="Нікнейм або email" required autoComplete="username" /></label>
      <label className="grid gap-1.5 text-sm font-medium">Пароль<Input name="password" type="password" placeholder="Пароль" aria-label="Пароль" required autoComplete="current-password" /></label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input name="rememberMe" type="checkbox" defaultChecked />
        Запам’ятати мене на цьому пристрої
      </label>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Вхід…" : "Увійти"}</Button>
    </form>
  );
}
