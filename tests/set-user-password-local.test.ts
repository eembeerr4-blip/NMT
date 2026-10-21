import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPasswordAsync, verifyPasswordAsync } from "@/lib/auth";

const repo = process.cwd();
const folder = mkdtempSync(path.join(tmpdir(), "nmt-owner-pw-"));
const database = path.join(folder, "qa-owner.db").replaceAll("\\", "/");
const databaseUrl = `file:${database}`;

beforeAll(() => {
  writeFileSync(database, "");
  execFileSync(process.execPath, [path.join(repo, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
    timeout: 60_000,
  });
}, 60_000);

afterAll(async () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  await prisma.$disconnect();
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = database + suffix;
    if (existsSync(file)) unlinkSync(file);
  }
});

it("updates owner password hash and revokes sessions on isolated SQLite", () => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  return hashPasswordAsync("old-owner-password-1").then(async (oldHash) => {
    await prisma.user.create({
      data: {
        id: "owner",
        role: "ADMIN",
        nickname: "owner",
        firstName: "Owner",
        onboarded: true,
        passwordHash: oldHash,
      },
    });
    await prisma.session.create({
      data: { userId: "owner", tokenHash: "session-to-revoke", expiresAt: new Date(Date.now() + 60_000) },
    });
    await prisma.$disconnect();

    execFileSync(
      process.execPath,
      [path.join(repo, "scripts/set-user-password-local.mjs"), "--database", databaseUrl, "--user-id", "owner"],
      {
        input: "new-owner-password-9\n",
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60_000,
      },
    );

    const verify = new PrismaClient({ datasourceUrl: databaseUrl });
    const owner = await verify.user.findUniqueOrThrow({ where: { id: "owner" } });
    expect(await verifyPasswordAsync("new-owner-password-9", owner.passwordHash)).toBe(true);
    expect(await verifyPasswordAsync("old-owner-password-1", owner.passwordHash)).toBe(false);
    expect(owner.nickname).toBe("owner");
    expect(owner.role).toBe("ADMIN");
    expect(owner.email).toBeNull();
    expect(await verify.session.count({ where: { userId: "owner" } })).toBe(0);
    await verify.$disconnect();
  });
});
