import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const backup = new DatabaseSync(
  path.resolve("D:/НМТ Сайт/backups/stage6-final-production-2026-10-29T11-50-33/dev.db"),
);
const working = new DatabaseSync(path.resolve("prisma/dev.db"));

const backupIds = new Set(
  backup
    .prepare("SELECT id FROM StudyTask")
    .all()
    .map((r) => r.id),
);

const newRows = working
  .prepare(
    "SELECT id, userId, topicId, subjectId, dateKey, kind, title, templateKey, durationMin, optional, sortOrder, createdAt, updatedAt, notes FROM StudyTask ORDER BY createdAt ASC",
  )
  .all()
  .filter((r) => !backupIds.has(r.id));

const auditAround = working
  .prepare(
    "SELECT id, action, actorId, entityType, entityId, summary, createdAt FROM AuditLog WHERE createdAt >= ? ORDER BY createdAt ASC",
  )
  .all(newRows[0]?.createdAt ? newRows[0].createdAt - 60000 : 0);

console.log(
  JSON.stringify(
    {
      newStudyTasks: newRows,
      auditWindow: auditAround,
      ownerTasksOn20261210: working
        .prepare("SELECT id, dateKey, title, createdAt FROM StudyTask WHERE userId='owner' AND dateKey='2026-12-10' ORDER BY createdAt")
        .all(),
    },
    null,
    2,
  ),
);

backup.close();
working.close();
