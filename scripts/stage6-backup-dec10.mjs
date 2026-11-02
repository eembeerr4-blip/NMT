import { DatabaseSync } from "node:sqlite";
const b = new DatabaseSync("D:/НМТ Сайт/backups/stage6-final-production-2026-10-29T11-50-33/dev.db");
const rows = b
  .prepare("SELECT templateKey, title FROM StudyTask WHERE userId='owner' AND dateKey='2026-12-10' ORDER BY templateKey")
  .all();
console.log(JSON.stringify({ backupDec10: rows }, null, 2));
b.close();
