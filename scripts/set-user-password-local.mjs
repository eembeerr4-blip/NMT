/**
 * Local-only password reset for a single user. Updates passwordHash and revokes sessions.
 * Password is read from stdin (one line). Do not pass passwords via argv or env.
 *
 * Usage:
 *   node scripts/set-user-password-local.mjs --database "file:D:/path/qa.db" --user-id owner --ack-local-reset < password.txt
 * Prefer scripts/set-owner-password.ps1 for hidden console input on Windows.
 */
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hashPasswordAsync, verifyPasswordAsync } from "../src/lib/auth.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { database: "", userId: "owner", ack: false, verify: false };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--database") options.database = argv[++index] ?? "";
    else if (token === "--user-id") options.userId = argv[++index] ?? "owner";
    else if (token === "--ack-local-reset") options.ack = true;
    else if (token === "--verify-only") options.verify = true;
  }
  return options;
}

function assertSafeDatabaseUrl(databaseUrl, ack) {
  if (!databaseUrl.startsWith("file:")) throw new Error("Only file: SQLite DATABASE_URL is supported.");
  const absolute = path.resolve(databaseUrl.slice("file:".length));
  const devDb = path.resolve(repo, "prisma/dev.db");
  if (path.normalize(absolute) === path.normalize(devDb) && !ack) {
    throw new Error(
      "Refusing to change prisma/dev.db without --ack-local-reset. Stop the app, run sqlite-online-backup.mjs, then re-run with owner approval.",
    );
  }
  return absolute;
}

async function readPasswordFromStdin() {
  if (stdin.isTTY) {
    throw new Error("Interactive TTY stdin is not supported here. Pipe the password or use set-owner-password.ps1.");
  }
  const lines = [];
  for await (const line of createInterface({ input: stdin })) lines.push(line);
  const password = lines.join("\n").trimEnd();
  if (!password || password.length < 8 || password.length > 1024) {
    throw new Error("Password must be 8–1024 characters.");
  }
  return password;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.database) throw new Error("Missing --database file:... absolute SQLite path.");
  if (!options.userId) throw new Error("Missing --user-id.");

  const databasePath = options.verify
    ? path.resolve(options.database.startsWith("file:") ? options.database.slice(5) : options.database)
    : assertSafeDatabaseUrl(options.database, options.ack);
  const prisma = new PrismaClient({ datasourceUrl: options.database });
  try {

  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: { id: true, nickname: true, role: true, email: true, passwordHash: true },
  });
  if (!user) throw new Error(`User ${options.userId} not found.`);

    if (options.verify) {
      console.log(
        JSON.stringify(
          {
            database: databasePath,
            user: {
              id: user.id,
              nickname: user.nickname,
              role: user.role,
              hasEmail: Boolean(user.email),
              hasPassword: Boolean(user.passwordHash?.length),
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    const password = await readPasswordFromStdin();
    const passwordHash = await hashPasswordAsync(password);
    const sessionsBefore = await prisma.session.count({ where: { userId: user.id } });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    const matches = await verifyPasswordAsync(password, updated.passwordHash);
    if (!matches) throw new Error("Password hash verification failed after update.");

    console.log(
      JSON.stringify(
        {
          ok: true,
          database: databasePath,
          userId: user.id,
          nickname: user.nickname,
          sessionsRevoked: sessionsBefore,
          passwordUpdated: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Password update failed.");
  process.exitCode = 1;
});
