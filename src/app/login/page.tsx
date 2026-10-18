import Link from "next/link";
import { login } from "@/server/actions";
import { Card } from "@/components/ui";
import { LoginForm, type LoginState } from "@/components/login-form";

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
        <Link href="/onboarding" className="block text-sm underline">Створити профіль</Link>
      </Card>
    </main>
  );
}
