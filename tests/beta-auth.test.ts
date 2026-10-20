import {afterAll,beforeAll,expect,it,vi} from "vitest";
import {execFileSync} from "node:child_process";
import {existsSync,unlinkSync,rmdirSync,writeFileSync} from "node:fs";
import path from "node:path";
const cookies=vi.hoisted(()=>new Map<string,string>());
vi.mock("@/lib/prisma",async()=>{
 const {PrismaClient}=await import("@prisma/client");const {mkdtempSync}=await import("node:fs");const {tmpdir}=await import("node:os");const path=await import("node:path");
 const folder=mkdtempSync(path.join(tmpdir(),"nmt-beta-auth-"));const database=path.join(folder,"qa.db");
 return {prisma:new PrismaClient({datasourceUrl:"file:"+database.replaceAll("\\","/")}),folder,database};
});
vi.mock("next/headers",()=>({cookies:async()=>({get:(key:string)=>cookies.has(key)?{value:cookies.get(key)}:undefined,set:(key:string,value:string)=>cookies.set(key,value),delete:(key:string)=>cookies.delete(key)}),headers:async()=>new Headers()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error("REDIRECT:"+url);},notFound:()=>{throw Error("NOT_FOUND");}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {hashPasswordAsync} from "@/lib/auth";
import {login,logout,restoreBackup} from "@/server/actions";
import {getSessionUser} from "@/server/session";
import {GET as backup} from "@/app/api/export/backup/route";

beforeAll(async()=>{
 const {database}=await import("@/lib/prisma") as unknown as {database:string};writeFileSync(database,"");
 execFileSync(process.execPath,[path.join(process.cwd(),"node_modules/prisma/build/index.js"),"migrate","deploy"],{env:{...process.env,DATABASE_URL:"file:"+database.replaceAll("\\","/")},stdio:"pipe",timeout:60000});
 const passwordHash=await hashPasswordAsync("QA-disposable-password");
 for(const [id,role] of [["QA-student","STUDENT"],["owner","OWNER"]])await prisma.user.create({data:{id,nickname:id==="owner"?"qa-owner":id.toLowerCase(),role,firstName:id,onboarded:true,passwordHash}});
},60000);
afterAll(async()=>{await prisma.$disconnect();const {folder,database}=await import("@/lib/prisma") as unknown as {folder:string;database:string};for(const suffix of ["","-wal","-shm"]){if(existsSync(database+suffix))unlinkSync(database+suffix);}rmdirSync(folder);});

it("beta regression: wrong password, case-insensitive login, logout, repeat login and session persistence",async()=>{
 expect((await login("QA-STUDENT","wrong")).ok).toBe(false);expect(cookies.size).toBe(0);expect(await prisma.session.count()).toBe(0);
 await expect(login("QA-STUDENT","QA-disposable-password")).rejects.toThrow("REDIRECT:/");
 expect((await getSessionUser())?.id).toBe("QA-student");expect((await getSessionUser())?.id).toBe("QA-student");expect(await prisma.session.count()).toBe(1);
 await expect(logout()).rejects.toThrow("REDIRECT:/login");expect(await getSessionUser()).toBeNull();expect(await prisma.session.count()).toBe(0);
 await expect(login("qa-student","QA-disposable-password")).rejects.toThrow("REDIRECT:/");expect((await getSessionUser())?.id).toBe("QA-student");
 await expect(prisma.user.create({data:{id:"QA-duplicate",nickname:"QA-STUDENT",firstName:"QA-duplicate"}})).rejects.toMatchObject({code:"P2002"});
 await expect(logout()).rejects.toThrow("REDIRECT:/login");
});
it("beta regression: real sessions enforce anonymous 401, student 403, owner 200 on backup",async()=>{
 expect((await backup()).status).toBe(401);
 await expect(login("qa-student","QA-disposable-password")).rejects.toThrow("REDIRECT:/");expect((await backup()).status).toBe(403);
 await expect(logout()).rejects.toThrow("REDIRECT:/login");
 await expect(login("qa-owner","QA-disposable-password")).rejects.toThrow("REDIRECT:/");
 await prisma.oAuthAccount.create({data:{userId:"QA-student",provider:"google",providerSubject:"qa-google-subject"}});
 await prisma.authToken.create({data:{userId:"QA-student",purpose:"RESET_PASSWORD",tokenHash:"qa-secret-token-hash",expiresAt:new Date(Date.now()+60000)}});
 await prisma.invitation.create({data:{codeHash:"qa-invite-secret-hash",email:"qa@example.com",createdById:"owner",expiresAt:new Date(Date.now()+60000)}});
 const response=await backup();expect(response.status).toBe(200);
 const snapshot=await response.json();expect(snapshot.users).toHaveLength(2);
 expect(snapshot.version).toBe(4);expect(snapshot.oauthAccounts).toHaveLength(1);
 expect(JSON.stringify(snapshot)).not.toContain("qa-secret-token-hash");
 expect(JSON.stringify(snapshot)).not.toContain("qa-invite-secret-hash");
 // Contains password hashes: deliberately never print the backup body.
 expect(snapshot.users.every((user:{passwordHash:string})=>Boolean(user.passwordHash))).toBe(true);
 const restored=await restoreBackup(JSON.stringify(snapshot),"ВІДНОВИТИ");
 expect(restored,JSON.stringify(restored)).toMatchObject({ok:true});
 expect(await prisma.oAuthAccount.count({where:{providerSubject:"qa-google-subject"}})).toBe(1);
 expect(await prisma.authToken.count()).toBe(0);
 expect(await prisma.invitation.count()).toBe(0);
});
