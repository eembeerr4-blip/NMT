import path from "node:path";
import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

export function e2eDb() {
  if (!client) {
    const url = `file:${path.join(process.cwd(), "prisma", "e2e.db")}`;
    client = new PrismaClient({ datasources: { db: { url } } });
  }
  return client;
}

export async function userRole(userId: string) {
  const row = await e2eDb().user.findUnique({ where: { id: userId }, select: { role: true } });
  return row?.role ?? null;
}

export async function topicIdByTitle(title: string) {
  const row = await e2eDb().topic.findFirst({ where: { title }, select: { id: true }, orderBy: { sortOrder: "desc" } });
  return row?.id ?? null;
}

export async function pendingUserByNickname(nickname: string) {
  return e2eDb().user.findUnique({
    where: { nickname },
    select: { id: true, accountStatus: true, email: true, emailVerifiedAt: true },
  });
}
