import Link from "next/link";
import { login } from "@/server/actions";
import { Button, Card, Input } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full space-y-3 p-6">
        <h1 className="text-xl font-semibold">Вхід до NMT Academy</h1>
        <p className="text-sm text-muted-foreground">Кожен профіль має власні результати, календар і аналітику.</p>
        <form action={async (formData) => { "use server"; await login(String(formData.get("nickname") ?? ""), String(formData.get("password") ?? "")); }} className="space-y-3">
          <Input name="nickname" placeholder="Нікнейм" required autoComplete="username" />
          <Input name="password" type="password" required autoComplete="current-password" />
          <Button type="submit">Увійти</Button>
        </form>
        <Link href="/onboarding" className="block text-sm underline">Створити профіль</Link>
      </Card>
    </main>
  );
}
