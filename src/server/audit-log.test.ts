import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const folder=mkdtempSync(path.join(tmpdir(),"nmt-audit-test-"));
  return { prisma: new PrismaClient({datasources:{db:{url:`file:${path.join(folder,"isolated.db").replaceAll("\\","/")}`}}}), testFolder:folder };
});
import { prisma } from "@/lib/prisma";
import { auditedWrite, recordAudit, safeAuditMetadata } from "./audit-log";
const actor={id:"admin-fixture",firstName:"Тест",nickname:"audit",role:"ADMIN"};

beforeAll(async()=>{
 await prisma.$executeRawUnsafe(`CREATE TABLE "AuditLog" (id TEXT NOT NULL PRIMARY KEY,actorId TEXT,actorName TEXT NOT NULL,actorRole TEXT NOT NULL,action TEXT NOT NULL,entityType TEXT NOT NULL,entityId TEXT,summary TEXT NOT NULL,metadataJson TEXT NOT NULL DEFAULT '{}',createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
 await prisma.$executeRawUnsafe('CREATE TABLE AuditProbe (id TEXT PRIMARY KEY, value TEXT)');
});
beforeEach(async()=>{await prisma.auditLog.deleteMany();await prisma.$executeRawUnsafe('DELETE FROM AuditProbe');});
afterAll(async()=>{
 await prisma.$disconnect();
 const {testFolder}=await import("@/lib/prisma") as unknown as {testFolder:string};
 rmSync(testFolder,{recursive:true,force:true});
});

describe("persistent audit journal",()=>{
 it("commits a successful change and an actor snapshot together",async()=>{
  await auditedWrite(actor,{action:"TOPIC_CREATED",entityType:"topic"},async tx=>{
   await tx.$executeRawUnsafe("INSERT INTO AuditProbe VALUES ('new-topic','saved')");
   return {ok:true,id:"new-topic"};
  });
  const event=await prisma.auditLog.findFirstOrThrow();
  expect(event).toMatchObject({actorId:actor.id,actorName:"Тест @audit",actorRole:"ADMIN",action:"TOPIC_CREATED",entityId:"new-topic"});
  expect(await prisma.$queryRawUnsafe('SELECT value FROM AuditProbe')).toEqual([{value:"saved"}]);
 });
 it("rolls back the content change when the journal cannot be written",async()=>{
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_audit BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END`);
  try{
   await expect(auditedWrite(actor,{action:"LESSON_SAVED",entityType:"topic"},async tx=>{
    await tx.$executeRawUnsafe("INSERT INTO AuditProbe VALUES ('lesson','changed')");
    return {ok:true};
   })).rejects.toThrow();
   expect(await prisma.$queryRawUnsafe('SELECT * FROM AuditProbe')).toEqual([]);
   expect(await prisma.auditLog.count()).toBe(0);
  }finally{await prisma.$executeRawUnsafe('DROP TRIGGER reject_audit');}
 });
 it("does not invent a success event for a rejected action",async()=>{
  await auditedWrite(actor,{action:"USER_ROLE_CHANGED",entityType:"user"},async()=>({ok:false,error:"forbidden"}));
  expect(await prisma.auditLog.count()).toBe(0);
 });
 it("records safe facts while excluding passwords, keys, tokens and arbitrary content",async()=>{
  await recordAudit(actor,{action:"INTEGRATIONS_SAVED",entityType:"settings",metadata:{password:"private-password",apiKey:"private-key",token:"private-token",fields:["integrations","private-note"],role:"ADMIN",count:2,body:"private-content"}});
  const event=await prisma.auditLog.findFirstOrThrow();
  expect(JSON.parse(event.metadataJson)).toEqual({fields:["integrations"],role:"ADMIN",count:2});
  expect(JSON.stringify(event)).not.toContain("private-");
 });
 it("rejects malformed metadata and unsafe roles",()=>{
  expect(safeAuditMetadata(null)).toEqual({});
  expect(safeAuditMetadata({role:"arbitrary secret",count:-1,version:NaN,fields:["lesson",12]})).toEqual({fields:["lesson"]});
 });
});
