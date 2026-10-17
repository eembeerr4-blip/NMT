import { buildBackup } from "@/server/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const backup = await buildBackup();
  return Response.json(backup, {
    headers: { "Content-Disposition": "attachment; filename=nmt-academy-backup.json" },
  });
}
