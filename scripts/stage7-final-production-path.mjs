/** Absolute production SQLite — never write from Stage 7 QA tooling. */
export const STAGE7_PRODUCTION_DB = "D:/НМТ Сайт/NMT-academy/prisma/dev.db";

export function normalizeDbPath(p) {
  return p.replace(/\\/g, "/");
}
