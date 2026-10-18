import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-16">
    <h1 className="text-2xl font-semibold">Сторінку не знайдено</h1>
    <p>Адреса не існує або цей матеріал недоступний вашому профілю.</p>
    <Link href="/" className="underline">Повернутися на головну</Link>
  </main>;
}
