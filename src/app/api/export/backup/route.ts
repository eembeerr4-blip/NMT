import { isOwner } from "@/lib/permissions";
import { buildBackup } from "@/server/actions";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Потрібен вхід." }, { status: 401 });
  if (!isOwner(user)) return Response.json({ error: "Повна резервна копія доступна лише власнику." }, { status: 403 });
  const backup = await buildBackup();
  return Response.json(backup, {
    headers: { "Content-Disposition": "attachment; filename=nmt-academy-backup.json" },
  });
}
