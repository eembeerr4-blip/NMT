import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const backup = new DatabaseSync(
  path.resolve("D:/НМТ Сайт/backups/stage6-final-production-2026-10-29T11-50-33/dev.db"),
);
const working = new DatabaseSync(path.resolve("prisma/dev.db"));
console.log(
  JSON.stringify(
    {
      backupStudyTasks: backup.prepare("SELECT COUNT(*) AS c FROM StudyTask").get(),
      workingStudyTasks: working.prepare("SELECT COUNT(*) AS c FROM StudyTask").get(),
      newestInWorking: working
        .prepare("SELECT id, userId, dateKey, createdAt, title FROM StudyTask ORDER BY createdAt DESC LIMIT 4")
        .all(),
      nonReadyTopicsSample: working
        .prepare("SELECT id, coverage FROM Topic WHERE coverage NOT IN ('READY') LIMIT 5")
        .all(),
    },
    null,
    2,
  ),
);
backup.close();
working.close();
