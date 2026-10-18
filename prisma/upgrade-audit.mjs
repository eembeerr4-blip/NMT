import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config({quiet:true});
if(process.argv[2]!=='--production') throw Error('Explicit --production argument required');
const db=new PrismaClient();
try {
 const tables=['User','Topic','Question','Test','TestAttempt','Answer','Note','StudyTask','UserTopicProgress'];
 const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,String((await db.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "${t}"`))[0].n)])));
 const before=await counts();
 const backup=path.resolve(`prisma/backups/before-audit-log-${Date.now()}.db`);
 fs.mkdirSync(path.dirname(backup),{recursive:true});
 await db.$executeRawUnsafe("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
 await db.$transaction(async tx=>{
  const existing=await tx.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='AuditLog'");
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY,"actorId" TEXT,"actorName" TEXT NOT NULL,"actorRole" TEXT NOT NULL,"action" TEXT NOT NULL,"entityType" TEXT NOT NULL,"entityId" TEXT,"summary" TEXT NOT NULL,"metadataJson" TEXT NOT NULL DEFAULT '{}',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  for(const [name,columns] of [['createdAt_id','"createdAt","id"'],['action_createdAt','"action","createdAt"'],['actorId_createdAt','"actorId","createdAt"']]) await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_${name}_idx" ON "AuditLog" (${columns})`);
  if(!existing.length)await tx.$executeRawUnsafe('INSERT INTO "AuditLog" (id,actorName,actorRole,action,entityType,summary,createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',randomUUID(),'Система','SYSTEM','SYSTEM_AUDIT_ENABLED','system','Журнал увімкнено',Date.now());
  // SQLite compares storage classes before values. Keep all dates in Prisma's millisecond format.
  await tx.$executeRawUnsafe(`UPDATE "AuditLog" SET "createdAt"=CAST(strftime('%s', "createdAt") AS INTEGER)*1000 WHERE typeof("createdAt")='text' AND strftime('%s', "createdAt") IS NOT NULL`);
 });
 const after=await counts();
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Unexpected data count change');
 console.log(JSON.stringify({backup,counts:after,integrity:await db.$queryRawUnsafe('PRAGMA integrity_check')}));
} finally {await db.$disconnect();}
