import Link from "next/link";
import { login } from "@/server/actions";
import { Card } from "@/components/ui";
import { LoginForm, type LoginState } from "@/components/login-form";
import { startGoogleAuth } from "@/server/google-oauth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full space-y-3 p-6">
        <h1 className="text-xl font-semibold">Вхід до NMT Academy</h1>
        <p className="text-sm text-muted-foreground">Кожен профіль має власні результати, календар і аналітику.</p>
        <LoginForm action={async (_previousState: LoginState, formData: FormData) => {
          "use server";
          const rememberMe = formData.get("rememberMe") === "on";
          const result = await login(String(formData.get("nickname") ?? ""), String(formData.get("password") ?? ""), rememberMe);
          return { error: result.error };
        }} />
        {process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_BASE_URL ? <form action={startGoogleAuth}>
          <input type="hidden" name="mode" value="login" />
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm">Увійти з Google</button>
        </form> : <p className="text-xs text-muted-foreground">Вхід Google стане доступним після налаштування власником.</p>}
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/forgot-password" className="underline">Забули пароль?</Link>
          <Link href="/register" className="underline">Зареєструватися</Link>
        </div>
      </Card>
    </main>
  );
}
