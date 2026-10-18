import { execSync } from "child_process";
import { existsSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";


const databasePath = path.join(process.cwd(), "prisma", "test.db");
const databaseUrl = "file:" + databasePath.replaceAll("\\", "/");
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

beforeAll(() => {
  if (existsSync(databasePath)) rmSync(databasePath);
  // Create the disposable SQLite file first; the Windows schema engine requires it.
  writeFileSync(databasePath, "");
  execSync(`"${process.execPath}" "${path.join(process.cwd(), "node_modules/prisma/build/index.js")}" db push --skip-generate --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
    timeout: 60000,
  });
}, 60000);

afterAll(async () => {
  await prisma.$disconnect();
  if (existsSync(databasePath)) rmSync(databasePath);
});

it("зберігає результат пробника і читає його після нового підключення", async () => {
  await prisma.subject.create({
    data: { id: "math", name: "Математика", shortName: "Математика", description: "Тест", color: "#4f6df5", sortOrder: 0 },
  });
  await prisma.examResult.create({
    data: {
      subjectId: "math",
      date: new Date("2026-09-30T12:00:00.000Z"),
      testType: "MANUAL",
      title: "Результат 30 вересня",
      ratingScore: 132,
      countsTowardAverage: true,
      comment: "Тестовий бал не вказано.",
    },
  });
  const saved = await prisma.examResult.findFirst({ where: { title: "Результат 30 вересня" } });
  expect(saved?.ratingScore).toBe(132);
  expect(saved?.rawScore).toBeNull();
});
