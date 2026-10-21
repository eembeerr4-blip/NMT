import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { verifyEmailAction } from "@/server/account-actions";
import { ResendVerificationForm } from "@/components/account-forms";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; invalid?: string; verified?: string }> }) {
  const { token, invalid, verified } = await searchParams;
  return <main className="stage02-auth mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
    <Card className="w-full space-y-4 p-6">
      <h1 className="text-xl font-semibold">{verified ? "Електронну пошту підтверджено!" : "Підтвердження email"}</h1>
      {verified ? <>
        <p role="status" className="text-sm text-muted-foreground">Ваш акаунт активовано. Тепер ви можете увійти до NMT Academy.</p>
        <Link href="/login" className="inline-flex min-h-10 items-center rounded-xl bg-action px-4 py-2 text-sm font-semibold text-primary-foreground">Увійти</Link>
      </> : invalid || !token ? <>
        <p role="alert" className="text-sm text-destructive">Посилання недійсне, прострочене або вже використане. Якщо адресу вже підтверджено, увійдіть у свій акаунт.</p>
        <ResendVerificationForm />
        <Link href="/login" className="block text-sm underline">Увійти</Link>
      </> :
        <form action={verifyEmailAction}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit">Підтвердити email</Button>
        </form>}
    </Card>
  </main>;
}
