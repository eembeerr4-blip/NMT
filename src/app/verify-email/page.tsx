import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { verifyEmailAction } from "@/server/account-actions";
import { ResendVerificationForm } from "@/components/account-forms";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; invalid?: string }> }) {
  const { token, invalid } = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
    <Card className="w-full space-y-4 p-6">
      <h1 className="text-xl font-semibold">Підтвердження email</h1>
      {invalid || !token ? <p role="alert" className="text-sm text-destructive">Посилання недійсне, прострочене або вже використане.</p> :
        <form action={verifyEmailAction}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit">Підтвердити email</Button>
        </form>}
      {invalid || !token ? <ResendVerificationForm /> : null}
      <Link href="/register" className="block text-sm underline">Зареєструватися</Link>
    </Card>
  </main>;
}
