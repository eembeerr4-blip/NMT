import Link from "next/link";
import { Card } from "@/components/ui";
import { ForgotPasswordForm } from "@/components/account-forms";

export default function ForgotPasswordPage() {
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
    <Card className="w-full space-y-4 p-6">
      <h1 className="text-xl font-semibold">Відновити пароль</h1>
      <p className="text-sm text-muted-foreground">Якщо підтверджений email належить вашому профілю, ми надішлемо одноразове посилання на 30 хвилин.</p>
      <ForgotPasswordForm />
      <Link href="/login" className="block text-sm underline">Назад до входу</Link>
    </Card>
  </main>;
}
