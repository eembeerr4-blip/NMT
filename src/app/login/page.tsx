import Link from "next/link";
import { login } from "@/server/actions";
import { Card } from "@/components/ui";
import { LoginForm, type LoginState } from "@/components/login-form";
import { startGoogleAuth } from "@/server/google-oauth";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

const oauthErrors: Record<string, string> = {
  link_required: "Акаунт із цією поштою вже існує. Підтвердьте пароль NMT Academy, щоб продовжити вхід через Google.",
  rate_limited: "Забагато спроб входу через Google. Спробуйте пізніше.",
  expired: "Час входу через Google минув. Спробуйте ще раз.",
  used: "Це посилання для входу вже використано. Спробуйте ще раз.",
  invalid: "Не вдалося перевірити вхід через Google. Спробуйте ще раз.",
  exchange_failed: "Google не підтвердив вхід. Спробуйте ще раз.",
  failed: "Не вдалося завершити вхід через Google. Спробуйте ще раз.",
};
const linkErrors: Record<string, string> = {
  link_failed: "Не вдалося підключити Google. Спробуйте ще раз.",
  email_mismatch: "Вибраний Google-акаунт має іншу пошту. Виберіть акаунт із поштою цього профілю.",
  email_in_use: "Вибраний Google-акаунт уже належить іншому профілю.",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ oauth?: string | string[]; reset?: string; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const oauth = params.oauth;
  const oauthError = typeof oauth === "string" && Object.hasOwn(oauthErrors, oauth) ? oauthErrors[oauth] : undefined;
  const linkError = typeof params.error === "string" && Object.hasOwn(linkErrors, params.error) ? linkErrors[params.error] : undefined;
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_BASE_URL);
  const linkUser = oauth === "confirm_link" ? await getSessionUser() : null;
  if (linkUser) return <main className="stage02-auth mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
    <Card className="w-full space-y-4 p-6">
      <h1 className="text-xl font-semibold">Завершити вхід через Google</h1>
      <p className="text-sm text-muted-foreground">Пароль підтверджено. Виберіть Google-акаунт із тією самою поштою, щоб підключити його до цього профілю.</p>
      {linkError ? <p role="alert" className="text-sm text-destructive">{linkError}</p> : null}
      {googleEnabled ? <form action={startGoogleAuth}>
        <input type="hidden" name="mode" value="link" />
        <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm">Продовжити з Google</button>
      </form> : <p role="alert" className="text-sm text-destructive">Вхід через Google тимчасово недоступний.</p>}
      <Link href={linkUser.onboarded ? "/" : "/onboarding"} className="block text-sm underline">Продовжити без Google</Link>
    </Card>
  </main>;
  return (
    <main className="stage02-auth mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full space-y-3 p-6">
        <h1 className="text-xl font-semibold">Вхід до NMT Academy</h1>
        <p className="text-sm text-muted-foreground">Кожен профіль має власні результати, календар і аналітику.</p>
        {oauthError ? <p role="alert" className="text-sm text-destructive">{oauthError}</p> : null}
        {params.reset === "1" ? <p role="status" className="text-sm text-foreground">Пароль змінено. Увійдіть із новим паролем.</p> : null}
        <LoginForm action={async (_previousState: LoginState, formData: FormData) => {
          "use server";
          const rememberMe = formData.get("rememberMe") === "on";
          const result = await login(String(formData.get("nickname") ?? ""), String(formData.get("password") ?? ""), rememberMe, oauth === "link_required");
          return { error: result.error, verificationNeeded: "verificationNeeded" in result && result.verificationNeeded === true };
        }} />
        {googleEnabled ? <form action={startGoogleAuth}>
          <input type="hidden" name="mode" value="login" />
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm">Продовжити з Google</button>
        </form> : <p className="text-xs text-muted-foreground">Вхід Google стане доступним після налаштування власником.</p>}
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/forgot-password" className="underline">Забули пароль?</Link>
          <Link href="/register" className="underline">Зареєструватися</Link>
        </div>
      </Card>
    </main>
  );
}
