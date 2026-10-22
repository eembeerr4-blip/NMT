import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync,rmSync} from "node:fs";
const auth=vi.hoisted(()=>({id:"owner"}));
vi.mock("@/lib/prisma",async()=>{
 const {PrismaClient}=await import("@prisma/client");const {mkdtempSync}=await import("node:fs");const {tmpdir}=await import("node:os");const path=await import("node:path");
 const folder=mkdtempSync(path.join(tmpdir(),"nmt-roles-"));return {prisma:new PrismaClient({datasources:{db:{url:`file:${path.join(folder,"roles.db").replaceAll("\\","/")}`}}}),folder};
});
vi.mock("@/server/session",()=>({getSessionUser:async()=>prisma.user.findUnique({where:{id:auth.id}}),createSession:vi.fn(),clearSession:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/headers",()=>({headers:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {hashPasswordAsync} from "@/lib/auth";
import {buildBackup,restoreBackup,updateUserRole} from "./actions";
beforeAll(async()=>{
 await prisma.$executeRawUnsafe(`CREATE TABLE User (id TEXT NOT NULL PRIMARY KEY,role TEXT NOT NULL DEFAULT 'STUDENT',diagnosticSkipped BOOLEAN NOT NULL DEFAULT false,firstName TEXT NOT NULL,lastName TEXT NOT NULL DEFAULT '',nickname TEXT NOT NULL UNIQUE,email TEXT UNIQUE,emailVerifiedAt DATETIME,passwordHash TEXT NOT NULL DEFAULT '',examYear INTEGER NOT NULL DEFAULT 2027,onboarded BOOLEAN NOT NULL DEFAULT false,accountStatus TEXT NOT NULL DEFAULT 'APPROVED',createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updatedAt DATETIME NOT NULL)`);
 await prisma.$executeRawUnsafe(`CREATE TABLE AuditLog (id TEXT NOT NULL PRIMARY KEY,actorId TEXT,actorName TEXT NOT NULL,actorRole TEXT NOT NULL,action TEXT NOT NULL,entityType TEXT NOT NULL,entityId TEXT,summary TEXT NOT NULL,metadataJson TEXT NOT NULL DEFAULT '{}',createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
 await prisma.$executeRawUnsafe(`CREATE TABLE UserSettings (id TEXT NOT NULL PRIMARY KEY,userId TEXT UNIQUE,theme TEXT NOT NULL DEFAULT 'system',examDate DATETIME,targetScore INTEGER NOT NULL DEFAULT 150,masteryHighMin INTEGER NOT NULL DEFAULT 10,masteryMidMin INTEGER NOT NULL DEFAULT 7,mathPriority INTEGER NOT NULL DEFAULT 35,ukrainianPriority INTEGER NOT NULL DEFAULT 25,historyPriority INTEGER NOT NULL DEFAULT 20,biologyPriority INTEGER NOT NULL DEFAULT 20,timerEnabled BOOLEAN NOT NULL DEFAULT true,scheduleJson TEXT NOT NULL,formatJson TEXT NOT NULL,planStart TEXT NOT NULL DEFAULT '2026-10-19',dailyMinutes INTEGER NOT NULL DEFAULT 150,intensity TEXT NOT NULL DEFAULT 'standard',preferredTime TEXT NOT NULL DEFAULT '18:00',studyDaysJson TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
 await prisma.$executeRawUnsafe(readFileSync("prisma/migrations/20261018130000_nickname_case_insensitive/migration.sql","utf8"));
});
beforeEach(async()=>{
 await prisma.auditLog.deleteMany();await prisma.userSettings.deleteMany();await prisma.user.deleteMany();auth.id="owner";
 const ownerPasswordHash=await hashPasswordAsync("owner-confirmation");
 for(const [id,role] of [["owner","ADMIN"],["admin","ADMIN"],["editor","EDITOR"],["student","STUDENT"]])await prisma.user.create({data:{id,role,nickname:`fixture_${id}`,firstName:"Тестовий профіль",onboarded:true,passwordHash:id==="owner"?ownerPasswordHash:"not-owner-password"}});
 await prisma.userSettings.create({data:{id:"default",userId:"owner",scheduleJson:"{}",formatJson:"{}"}});
});
afterAll(async()=>{await prisma.$disconnect();const {folder}=await import("@/lib/prisma") as unknown as {folder:string};rmSync(folder,{recursive:true,force:true});});
describe("role changes on an isolated real database",()=>{
 it("enforces case-insensitive nickname uniqueness in SQLite",async()=>{
  await expect(prisma.user.create({data:{id:"duplicate",nickname:"FIXTURE_OWNER",firstName:"Duplicate"}})).rejects.toMatchObject({code:"P2002"});
 });
 it("assigns an additional owner, gives it working administrative rights and preserves the initial owner",async()=>{
  expect((await updateUserRole("student","OWNER",{password:"owner-confirmation"})).ok).toBe(true);
  expect((await prisma.user.findUniqueOrThrow({where:{id:"owner"}})).role).toBe("ADMIN");
  auth.id="student";expect((await updateUserRole("editor","ADMIN")).ok).toBe(true);
  expect((await prisma.user.findUniqueOrThrow({where:{id:"editor"}})).role).toBe("ADMIN");
  const events=await prisma.auditLog.findMany();expect(events).toHaveLength(2);expect(events.find(event=>event.actorId==="student")?.actorRole).toBe("OWNER");
 });
 it("denies privilege escalation and owner demotion to an administrator",async()=>{
  auth.id="admin";for(const role of ["OWNER","ADMIN"])expect((await updateUserRole("student",role)).ok).toBe(false);
  expect((await updateUserRole("owner","STUDENT")).ok).toBe(false);expect(await prisma.auditLog.count()).toBe(0);
  expect((await prisma.user.findUniqueOrThrow({where:{id:"student"}})).role).toBe("STUDENT");
 });
 it("creates personal settings when elevating a learner to editor",async()=>{
  expect(await prisma.userSettings.findUnique({where:{userId:"student"}})).toBeNull();
  expect((await updateUserRole("student","EDITOR")).ok).toBe(true);
  expect(await prisma.userSettings.findUnique({where:{userId:"student"}})).toMatchObject({userId:"student"});
 });
 it("ensureUserSettings does not duplicate or overwrite existing rows",async()=>{
  const {ensureUserSettings}=await import("@/server/sync");
  await prisma.userSettings.create({data:{id:"student",userId:"student",scheduleJson:'{"marker":true}',formatJson:"{}",targetScore:111}});
  const first=await ensureUserSettings("student",prisma);
  const second=await ensureUserSettings("student",prisma);
  expect(first.id).toBe(second.id);
  expect(second.targetScore).toBe(111);
  expect(await prisma.userSettings.count({where:{userId:"student"}})).toBe(1);
 });
 it("allows lower role management while refusing full backup and restore to admins",async()=>{
  auth.id="admin";expect((await updateUserRole("student","EDITOR")).ok).toBe(true);
  await expect(buildBackup()).rejects.toThrow("власнику");expect((await restoreBackup("{}","ВІДНОВИТИ")).ok).toBe(false);
 });
 it("rolls a role change back if the audit record cannot be saved",async()=>{
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_role_audit BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT,'audit unavailable'); END`);
  try{expect((await updateUserRole("student","OWNER",{password:"owner-confirmation"})).ok).toBe(false);expect((await prisma.user.findUniqueOrThrow({where:{id:"student"}})).role).toBe("STUDENT");expect(await prisma.auditLog.count()).toBe(0);}finally{await prisma.$executeRawUnsafe('DROP TRIGGER reject_role_audit');}
 });
 it("requires owner password confirmation before removing owner access",async()=>{
  expect((await updateUserRole("student","OWNER",{password:"owner-confirmation"})).ok).toBe(true);
  expect((await updateUserRole("student","STUDENT",{password:"wrong"})).ok).toBe(false);
  expect((await updateUserRole("student","STUDENT",{password:"owner-confirmation"})).ok).toBe(true);
 });
 it("rejects an editor or student attempting a role mutation",async()=>{
  for(const id of ["editor","student"]){auth.id=id;expect((await updateUserRole("admin","STUDENT")).ok).toBe(false);}
  expect(await prisma.auditLog.count()).toBe(0);
 });
});
