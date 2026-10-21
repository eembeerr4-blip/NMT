import Link from "next/link";
import { Card } from "@/components/ui";
import { ResetPasswordForm } from "@/components/account-forms";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="stage02-auth mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
    <Card className="w-full space-y-4 p-6">
      <h1 className="text-xl font-semibold">Новий пароль</h1>
      {token ? <ResetPasswordForm token={token} /> : <p role="alert">Посилання відсутнє або недійсне.</p>}
      <Link href="/login" className="block text-sm underline">Назад до входу</Link>
    </Card>
  </main>;
}
