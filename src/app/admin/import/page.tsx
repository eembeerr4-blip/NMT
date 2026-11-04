import { ContentImportForm } from "@/components/content-import-form";
import { PageHeader } from "@/components/ui";
import { requireContentEditor } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ContentImportPage() {
  await requireContentEditor();
  return <>
    <PageHeader title="Імпорт навчальних матеріалів" description="Завантажте пакет тем, уроків і завдань. Система спочатку покаже перевірку, а після підтвердження збереже все чернетками. Учням матеріал стає видимим лише після окремої публікації." />
    <ContentImportForm />
  </>;
}
