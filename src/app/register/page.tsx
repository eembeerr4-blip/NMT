import Link from "next/link";
import { Card } from "@/components/ui";
import { RegistrationForm, ResendVerificationForm } from "@/components/account-forms";
import { startGoogleAuth } from "@/server/google-oauth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ oauth?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto max-w-md space-y-5 px-4 py-8">
    <Card className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Реєстрація</h1>
      <p className="text-sm text-muted-foreground">Для закритого бета-тестування потрібен одноразовий код запрошення, прив’язаний до вашої електронної пошти.</p>
      {params.oauth ? <p role="alert" className="text-sm text-destructive">Вхід Google не завершено. Перевірте запрошення або прив’яжіть Google у налаштуваннях існуючого профілю.</p> : null}
      <RegistrationForm />
      {process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_BASE_URL ? <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm">Або зареєструйтеся через Google:</p>
        <form action={startGoogleAuth} className="space-y-2">
          <input type="hidden" name="mode" value="register" />
          <label className="grid gap-1 text-sm">Запрошення<input name="invitation" required className="w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Email запрошення<input name="email" type="email" required className="w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm">Продовжити з Google</button>
        </form>
      </div> : null}
      <Link href="/login" className="block text-sm underline">Вже маєте акаунт? Увійти</Link>
    </Card>
    <Card className="p-6"><ResendVerificationForm /></Card>
  </main>;
}
