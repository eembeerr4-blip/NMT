import { PrismaClient } from "@prisma/client";
import { DEFAULT_FORMAT, REQUIRED_SUBJECT_IDS, SUBJECTS } from "../src/lib/constants";
import { outlines } from "./outlines";

const prisma = new PrismaClient();
const OWNER = "owner";
const SEED_IDS = ["seed-math-diag", "seed-ukr-diag", "seed-hist-diag", "seed-bio-diag", "seed-math-sep30", "seed-hist-oct2", "seed-bio-oct3"];

async function main() {
  const before = await prisma.examResult.count();
  for (const [index, subject] of SUBJECTS.entries()) {
    await prisma.subject.upsert({
      where: { id: subject.id },
      update: { name: subject.name, shortName: subject.shortName, description: subject.description, color: subject.color, sortOrder: index },
      create: { id: subject.id, name: subject.name, shortName: subject.shortName, description: subject.description, color: subject.color, sortOrder: index },
    });
  }
  for (const topic of outlines) {
    await prisma.topic.upsert({
      where: { id: topic.id },
      update: { title: topic.title, summary: topic.summary, coverage: "NEEDS_CONTENT" },
      create: topic,
    });
  }
  const rich = await prisma.topic.findMany({ where: { NOT: { summary: { contains: "ще не додані" } } }, select: { id: true } });
  if (rich.length) {
    await prisma.topic.updateMany({
      where: { id: { in: rich.map((topic) => topic.id) }, coverage: { notIn: ["VERIFIED", "NEEDS_CONTENT"] }, lessonJson: "" },
      data: { coverage: "NEEDS_REVIEW" },
    });
  }
  await prisma.user.upsert({
    where: { id: OWNER },
    update: {},
    create: { id: OWNER, firstName: "Власник", nickname: "owner", examYear: 2027, onboarded: false },
  });
  const settings = await prisma.userSettings.findUnique({ where: { id: "default" } });
  if (settings && !settings.userId) await prisma.userSettings.update({ where: { id: "default" }, data: { userId: OWNER } });
  if (!settings) {
    await prisma.userSettings.create({ data: { id: "default", userId: OWNER, scheduleJson: "{}", formatJson: JSON.stringify(DEFAULT_FORMAT) } });
  }
  const personal = ["examResult", "studyTask", "testAttempt", "mistake", "reviewSchedule", "studySession", "flashcard"] as const;
  for (const model of personal) {
    const delegate = prisma[model] as unknown as { updateMany: (args: { where: { userId: null }; data: { userId: string } }) => Promise<unknown> };
    await delegate.updateMany({ where: { userId: null }, data: { userId: OWNER } });
  }
  for (const subjectId of REQUIRED_SUBJECT_IDS) {
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: OWNER, subjectId } },
      update: { active: true, role: "REQUIRED" },
      create: { userId: OWNER, subjectId, role: "REQUIRED", active: true },
    });
  }
  await prisma.userSubject.upsert({
    where: { userId_subjectId: { userId: OWNER, subjectId: "biology" } },
    update: { active: true, role: "ELECTIVE" },
    create: { userId: OWNER, subjectId: "biology", role: "ELECTIVE", active: true },
  });
  const topics = await prisma.topic.findMany({ select: { id: true, status: true, lastCorrect: true, lastTotal: true } });
  for (const topic of topics) {
    if (topic.status === "NOT_STARTED" && topic.lastCorrect == null) continue;
    await prisma.userTopicProgress.upsert({
      where: { userId_topicId: { userId: OWNER, topicId: topic.id } },
      update: {},
      create: { userId: OWNER, topicId: topic.id, status: topic.status, lastCorrect: topic.lastCorrect, lastTotal: topic.lastTotal },
    });
  }
  const after = await prisma.examResult.count();
  const owned = await prisma.examResult.count({ where: { userId: OWNER } });
  const missing = SEED_IDS.filter(async () => false);
  const rows = await prisma.examResult.findMany({ where: { id: { in: SEED_IDS } }, select: { id: true, userId: true } });
  if (before !== after) throw new Error(`Кількість результатів змінилася: ${before} → ${after}`);
  if (rows.length !== SEED_IDS.length || rows.some((row) => row.userId !== OWNER)) {
    throw new Error(`Історичні результати не прив'язані до власника: ${rows.map((row) => row.id).join(", ")}`);
  }
  console.log(`owner results ${owned}, total ${after}, seed ${rows.length}, skipped ${missing.length}`);
  await prisma.$disconnect();
}

main();
