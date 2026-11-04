import { PrismaClient } from "@prisma/client";
import { initializeSQLite, sqliteConnectionUrl } from "./sqlite-init";
const globalForPrisma=globalThis as unknown as {prisma?:PrismaClient;sqliteInitialization?:WeakMap<PrismaClient,Promise<void>>};
const databaseUrl=sqliteConnectionUrl(process.env.DATABASE_URL);
export const prisma=globalForPrisma.prisma??new PrismaClient(databaseUrl?{datasources:{db:{url:databaseUrl}}}:undefined);
globalForPrisma.prisma=prisma;
const initialization=globalForPrisma.sqliteInitialization??=new WeakMap();
if(!initialization.has(prisma))initialization.set(prisma,initializeSQLite(prisma));
