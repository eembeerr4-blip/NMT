/**
 * Synthetic QA database for Stage 5 worktree smoke tests.
 * Run: DATABASE_URL="file:./prisma/stage5-qa.db" npx prisma migrate deploy && tsx prisma/seed-stage5-qa.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { addDateKeys, dateKey } from "../src/lib/dates";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE, SUBJECTS } from "../src/lib/constants";

const prisma = new PrismaClient();
const lessonPublished = JSON.stringify({
  objectives: ["Мета"],
  theory: "Конспект для QA Stage 5 ".repeat(40),
  rules: ["Правило"],
  examples: [{ task: "1", solution: "1" }, { task: "2", solution: "2" }],
  mistakes: ["Помилка"],
  summary: "Підсумок",
});

async function main() {
  await prisma.mistake.deleteMany();
  await prisma.reviewSchedule.deleteMany();
  await prisma.userTopicProgress.deleteMany();
  await prisma.question.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.userSubject.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subject.deleteMany();

  await prisma.subject.createMany({
    data: SUBJECTS.map((subject, index) => ({
      id: subject.id,
      name: subject.name,
      shortName: subject.shortName,
      description: subject.description,
      color: subject.color,
      sortOrder: index,
    })),
  });
  await prisma.user.create({
    data: {
      id: "stage5-smoke",
      nickname: "stage5-smoke",
      firstName: "Stage5",
      onboarded: true,
      accountStatus: "APPROVED",
      role: "STUDENT",
      passwordHash: hashPassword("stage5-smoke-pass"),
    },
  });
  await prisma.userSettings.create({
    data: { id: "stage5-smoke", userId: "stage5-smoke", mathPriority: 30, scheduleJson: JSON.stringify(DEFAULT_SCHEDULE), formatJson: JSON.stringify(DEFAULT_FORMAT) },
  });
  await prisma.userSubject.create({ data: { userId: "stage5-smoke", subjectId: "math", role: "mandatory", active: true } });
  await prisma.topic.create({
    data: {
      id: "stage5-smoke-topic",
      subjectId: "math",
      title: "Smoke topic",
      coverage: "READY",
      sortOrder: 0,
      lessonJson: lessonPublished,
      questions: {
        create: { id: "stage5-smoke-q", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "2+2", correctAnswer: "4", explanation: "4", verificationStatus: "VERIFIED" },
      },
    },
  });
  const today = dateKey();
  await prisma.mistake.create({
    data: {
      id: "stage5-smoke-mistake",
      userId: "stage5-smoke",
      subjectId: "math",
      topicId: "stage5-smoke-topic",
      questionId: "stage5-smoke-q",
      prompt: "2+2",
      userAnswer: "3",
      correctAnswer: "4",
      explanation: "4",
      status: "OPEN",
    },
  });
  await prisma.reviewSchedule.create({
    data: { id: "stage5-smoke-review", userId: "stage5-smoke", topicId: "stage5-smoke-topic", dueKey: today, intervalDays: 1, status: "PENDING" },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
