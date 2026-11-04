import { SUBJECT_IDS } from "@/lib/constants";
import { getSessionUser } from "@/server/session";
import { prisma } from "@/lib/prisma";

export async function subjectPriorities() {
  const user = await getSessionUser();
  const settings = user ? await prisma.userSettings.findUnique({ where: { userId: user.id } }) : null;
  return {
    math: settings?.mathPriority ?? 35,
    ukrainian: settings?.ukrainianPriority ?? 25,
    history: settings?.historyPriority ?? 20,
    biology: settings?.biologyPriority ?? 20,
    ids: SUBJECT_IDS,
  };
}
