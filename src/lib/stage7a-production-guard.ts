import path from "node:path";

/** Resolve SQLite file path the same way Prisma does for typical file: URLs in this repo. */
export function resolveSqliteFilePath(databaseUrl: string, cwd = process.cwd()): string {
  const raw = databaseUrl.trim();
  if (!raw.startsWith("file:")) {
    throw new Error(`Stage 7A QA refused: DATABASE_URL must be a file: SQLite URL, got "${raw.slice(0, 40)}…"`);
  }
  const filePart = raw.slice("file:".length);
  if (path.isAbsolute(filePart)) return path.normalize(filePart);
  const relative = filePart.replace(/^\.\//, "");
  if (relative.startsWith("prisma/") || relative.includes("/")) {
    return path.normalize(path.join(cwd, relative));
  }
  return path.normalize(path.join(cwd, "prisma", relative));
}

export function productionDevDbPath(cwd = process.cwd()): string {
  return path.normalize(path.join(cwd, "prisma", "dev.db"));
}

/** Throws when DATABASE_URL would write to the working production SQLite. */
export function assertStage7aQaDatabase(databaseUrl = process.env.DATABASE_URL ?? "", cwd = process.cwd()): string {
  if (!databaseUrl) {
    throw new Error("Stage 7A QA refused: DATABASE_URL is empty.");
  }
  const resolved = resolveSqliteFilePath(databaseUrl, cwd);
  const production = productionDevDbPath(cwd);
  if (resolved === production) {
    throw new Error(
      `Stage 7A QA refused: DATABASE_URL resolves to production dev.db.\n  QA: ${resolved}\n  Production: ${production}`,
    );
  }
  return resolved;
}
