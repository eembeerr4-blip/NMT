import { PrismaClient } from "@prisma/client";
import { initializeSQLite } from "./sqlite-init";
const globalForPrisma=globalThis as unknown as {prisma?:PrismaClient;sqliteInitialization?:WeakMap<PrismaClient,Promise<void>>};
export const prisma=globalForPrisma.prisma??new PrismaClient();
const initialization=globalForPrisma.sqliteInitialization??=new WeakMap();
if(!initialization.has(prisma))initialization.set(prisma,initializeSQLite(prisma));
if(process.env.NODE_ENV!=="production")globalForPrisma.prisma=prisma;
