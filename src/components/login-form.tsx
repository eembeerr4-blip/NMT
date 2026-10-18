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
      <Input name="nickname" placeholder="Нікнейм" aria-label="Нікнейм" required autoComplete="username" />
      <Input name="password" type="password" placeholder="Пароль" aria-label="Пароль" required autoComplete="current-password" />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input name="rememberMe" type="checkbox" defaultChecked />
        Запам’ятати мене на цьому пристрої
      </label>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Вхід…" : "Увійти"}</Button>
    </form>
  );
}
