import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { normalizeNickname } from "../../src/lib/nickname";
import { sqliteConnectionUrl } from "../../src/lib/sqlite-init";

let client: PrismaClient | undefined;

export function e2eDb() {
  if (!client) {
    const url = sqliteConnectionUrl(`file:${path.join(process.cwd(), "prisma", "e2e.db").replaceAll("\\", "/")}`);
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
    where: { nickname: normalizeNickname(nickname) },
    select: { id: true, accountStatus: true, email: true, emailVerifiedAt: true },
  });
}

/** Wait until registration commit is visible to the E2E Prisma client (SQLite WAL). */
export async function waitForE2eUserByNickname(nickname: string, attempts = 40, delayMs = 100) {
  const normalized = normalizeNickname(nickname);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const user = await e2eDb().user.findUnique({ where: { nickname: normalized } });
    if (user) return user;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function waitForE2eAccountStatus(
  nickname: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
  attempts = 50,
  delayMs = 100,
) {
  const normalized = normalizeNickname(nickname);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const user = await e2eDb().user.findUnique({
      where: { nickname: normalized },
      select: { accountStatus: true, emailVerifiedAt: true },
    });
    if (user?.accountStatus === status) return user;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function waitForE2eEmailVerified(nickname: string, attempts = 50, delayMs = 100) {
  const normalized = normalizeNickname(nickname);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const user = await e2eDb().user.findUnique({
      where: { nickname: normalized },
      select: { emailVerifiedAt: true },
    });
    if (user?.emailVerifiedAt) return user;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
