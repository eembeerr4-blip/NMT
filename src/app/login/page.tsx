import Link from "next/link";
import { login } from "@/server/actions";
import { Card } from "@/components/ui";
import { LoginForm, type LoginState } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ reset?: string; rejected?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="stage02-auth mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full space-y-3 p-6">
        <h1 className="text-xl font-semibold">Вхід до NMT Academy</h1>
        <p className="text-sm text-muted-foreground">Кожен профіль має власні результати, календар і аналітику.</p>
        {params.reset === "1" ? <p role="status" className="text-sm text-foreground">Пароль змінено. Увійдіть із новим паролем.</p> : null}
        {params.rejected === "1" ? <p role="alert" className="text-sm">Заявку на реєстрацію відхилили. Зверніться до власника платформи.</p> : null}
        <LoginForm action={async (_previousState: LoginState, formData: FormData) => {
          "use server";
          const rememberMe = formData.get("rememberMe") === "on";
          const result = await login(String(formData.get("nickname") ?? ""), String(formData.get("password") ?? ""), rememberMe);
          return { error: result.error, verificationNeeded: "verificationNeeded" in result && result.verificationNeeded === true };
        }} />
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/forgot-password" className="underline">Забули пароль?</Link>
          <Link href="/register" className="underline">Зареєструватися</Link>
        </div>
      </Card>
    </main>
  );
}
