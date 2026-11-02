import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function tableFingerprint(name: string) {
  const countRows = await prisma.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*) as c FROM "${name}"`);
  const count = Number(countRows[0].c);
  if (count === 0) return { count, hash: "empty" };
  const rows = await prisma.$queryRawUnsafe<{ blob: string }[]>(
    `SELECT group_concat(rowid || ':' || quote(rowid), '|') as blob FROM "${name}" ORDER BY rowid`,
  );
  const hash = createHash("sha256").update(rows[0]?.blob ?? "").digest("hex");
  return { count, hash };
}

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const userTables = tables.filter((t) => !t.name.startsWith("_prisma"));
  const integrity = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  const fk = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  const topics = await prisma.topic.findMany({ select: { lessonJson: true } });
  let answerCheck = 0;
  for (const topic of topics) {
    try {
      const lesson = JSON.parse(topic.lessonJson || "{}") as { examples?: { answerCheck?: unknown }[] };
      for (const example of lesson.examples ?? []) if (example.answerCheck) answerCheck += 1;
    } catch {
      /* ignore */
    }
  }
  const studyTasks = await prisma.studyTask.count();
  const videos = await prisma.videoLesson.groupBy({ by: ["reviewStatus"], _count: { _all: true } });
  const draftTopics = await prisma.topic.count({ where: { coverage: "DRAFT" } });
  const fingerprints: Record<string, { count: number; hash: string }> = {};
  for (const { name } of userTables) fingerprints[name] = await tableFingerprint(name);
  console.log(
    JSON.stringify(
      {
        userTableCount: userTables.length,
        tableNames: userTables.map((t) => t.name),
        integrity,
        fkCount: Array.isArray(fk) ? fk.length : 0,
        answerCheck,
        studyTasks,
        draftTopics,
        videos,
        fingerprints,
      },
      null,
      2,
    ),
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
