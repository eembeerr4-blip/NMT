import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.includes("e2e.db")) throw new Error("bootstrap лише для e2e.db");
  await prisma.user.update({
    where: { id: "owner" },
    data: { passwordHash: hashPassword("test-pass-2027"), onboarded: true, firstName: "Тест" },
  });
  await prisma.$disconnect();
}

main();
