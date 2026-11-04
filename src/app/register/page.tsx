import { RegistrationForm } from "@/components/account-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function RegisterPage() {
  return (
    <main className="stage02-auth mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <Card className="w-full space-y-4 p-6">
        <PageHeader title="Реєстрація" description="Створіть профіль учня NMT Academy. Після реєстрації підтвердьте email." />
        <RegistrationForm />
      </Card>
    </main>
  );
}
