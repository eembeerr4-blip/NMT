import Link from "next/link";
import { Card } from "@/components/ui";
import { RegistrationForm } from "@/components/account-forms";
import { startGoogleAuth } from "@/server/google-oauth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ oauth?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto max-w-md space-y-5 px-4 py-8">
    <Card className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Реєстрація</h1>
      {params.oauth ? <p role="alert" className="text-sm text-destructive">Реєстрацію через Google не завершено. Спробуйте ще раз або увійдіть до існуючого профілю.</p> : null}
      <RegistrationForm googleAction={process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_BASE_URL ? startGoogleAuth : undefined} />
      <Link href="/login" className="block text-sm underline">Вже маєте акаунт? Увійти</Link>
    </Card>
  </main>;
}
