import { PrismaClient } from '@prisma/client'; import fs from 'node:fs'; import path from 'node:path'; import dotenv from 'dotenv'; dotenv.config({quiet:true});
if(!['--audit','--production'].includes(process.argv[2])) throw Error('Specify --audit or --production');
if(process.argv[2]==='--audit')process.env.DATABASE_URL='file:./audit-20261017.e2e.db';
const db=new PrismaClient();
(async()=>{
 const critical=['User','UserSubject','UserTopicProgress','TestAttempt','Answer','ExamResult','Note','StudyTask','VideoLesson'];
 const counts=async()=>Object.fromEntries(await Promise.all(critical.map(async t=>[t,(await db.$queryRawUnsafe('SELECT COUNT(*) AS n FROM "'+t+'"'))[0].n.toString()])));
 const before=await counts();
 const backup=path.resolve('prisma/backups/'+(process.argv[2]==='--audit'?'audit':'production')+'-before-personal-video-'+Date.now()+'.db');fs.mkdirSync(path.dirname(backup),{recursive:true});
 await db.$executeRawUnsafe("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
 await db.$transaction(async tx=>{
 const columns=await tx.$queryRawUnsafe('PRAGMA table_info("User")');
 if(!columns.some(c=>c.name==='role'))await tx.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT \'STUDENT\'');
 if(!columns.some(c=>c.name==='diagnosticSkipped'))await tx.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "diagnosticSkipped" BOOLEAN NOT NULL DEFAULT false');
 await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "UserVideoProgress" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "videoId" TEXT NOT NULL, "lastPositionSec" INTEGER NOT NULL DEFAULT 0, "notes" TEXT NOT NULL DEFAULT \'\', "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE, FOREIGN KEY ("videoId") REFERENCES "VideoLesson"("id") ON DELETE CASCADE)');
 await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "UserVideoProgress_userId_videoId_key" ON "UserVideoProgress"("userId","videoId")');
 await tx.$executeRawUnsafe('UPDATE "User" SET "role"=\'ADMIN\' WHERE "id"=\'owner\'');
 await tx.$executeRawUnsafe('INSERT OR IGNORE INTO "UserVideoProgress" (id,userId,videoId,lastPositionSec,notes,updatedAt) SELECT \'legacy-\'||v.id,\'owner\',v.id,v.lastPositionSec,v.notes,CURRENT_TIMESTAMP FROM "VideoLesson" v WHERE EXISTS(SELECT 1 FROM "User" WHERE id=\'owner\') AND (v.lastPositionSec>0 OR v.notes<>\'\')');
 });
 const after=await counts();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Critical record counts changed');
 console.log(JSON.stringify({backup,counts:after,integrity:await db.$queryRawUnsafe('PRAGMA integrity_check')}));
})().finally(()=>db.$disconnect());
