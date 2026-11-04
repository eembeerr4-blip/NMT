/**
 * Synthetic QA database for Stage 5 worktree (visual + logic QA).
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

const longMathPrompt =
  "Розв'яжіть рівняння $$x^2+\\frac{1}{2}=\\frac{3}{4}$$ та поясніть кроки. " +
  "Додатковий контекст для перевірки переносу рядків у картці помилки. ".repeat(8);

async function main() {
  await prisma.mistake.deleteMany();
  await prisma.reviewSchedule.deleteMany();
  await prisma.userTopicProgress.deleteMany();
  await prisma.examResult.deleteMany();
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

  for (const [id, nickname] of [
    ["stage5-smoke", "stage5-smoke"],
    ["stage5-other", "stage5-other"],
  ] as const) {
    await prisma.user.create({
      data: {
        id,
        nickname,
        firstName: id,
        onboarded: true,
        accountStatus: "APPROVED",
        role: "STUDENT",
        passwordHash: hashPassword(id === "stage5-smoke" ? "stage5-smoke-pass" : "stage5-other-pass"),
      },
    });
    await prisma.userSettings.create({
      data: { id, userId: id, mathPriority: 30, scheduleJson: JSON.stringify(DEFAULT_SCHEDULE), formatJson: JSON.stringify(DEFAULT_FORMAT) },
    });
    await prisma.userSubject.create({ data: { userId: id, subjectId: "math", role: "mandatory", active: true } });
  }

  await prisma.topic.create({
    data: {
      id: "stage5-smoke-topic",
      subjectId: "math",
      title: "Smoke topic · рівняння",
      coverage: "READY",
      sortOrder: 0,
      lessonJson: lessonPublished,
      questions: {
        create: [
          { id: "stage5-q-open", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: longMathPrompt, correctAnswer: "1", explanation: "Пояснення з формулою $$x=1$$", verificationStatus: "VERIFIED" },
          { id: "stage5-q-review", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "REVIEWING QA prompt", correctAnswer: "2", explanation: "2", verificationStatus: "VERIFIED" },
          { id: "stage5-q-fixed", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "FIXED QA prompt", correctAnswer: "3", explanation: "3", verificationStatus: "VERIFIED" },
        ],
      },
    },
  });

  await prisma.topic.create({
    data: {
      id: "stage5-draft-topic",
      subjectId: "math",
      title: "STAGE5_DRAFT_HIDDEN",
      coverage: "DRAFT",
      sortOrder: 1,
      lessonJson: lessonPublished,
      questions: {
        create: { id: "stage5-q-draft", subjectId: "math", type: "NUMERIC", difficulty: "EASY", prompt: "HIDDEN_DRAFT_QA", correctAnswer: "9", explanation: "9", verificationStatus: "VERIFIED" },
      },
    },
  });

  const today = dateKey();
  await prisma.mistake.createMany({
    data: [
      { id: "sm-open", userId: "stage5-smoke", subjectId: "math", topicId: "stage5-smoke-topic", questionId: "stage5-q-open", prompt: longMathPrompt, userAnswer: "0", correctAnswer: "1", explanation: "Пояснення з формулою $$x=1$$", status: "OPEN" },
      { id: "sm-review", userId: "stage5-smoke", subjectId: "math", topicId: "stage5-smoke-topic", questionId: "stage5-q-review", prompt: "REVIEWING QA prompt", userAnswer: "0", correctAnswer: "2", explanation: "2", status: "REVIEWING" },
      { id: "sm-fixed", userId: "stage5-smoke", subjectId: "math", topicId: "stage5-smoke-topic", questionId: "stage5-q-fixed", prompt: "FIXED QA prompt", userAnswer: "0", correctAnswer: "3", explanation: "3", status: "FIXED" },
      { id: "sm-draft", userId: "stage5-smoke", subjectId: "math", topicId: "stage5-draft-topic", questionId: "stage5-q-draft", prompt: "HIDDEN_DRAFT_QA", userAnswer: "0", correctAnswer: "9", explanation: "9", status: "OPEN" },
      { id: "sm-other", userId: "stage5-other", subjectId: "math", topicId: "stage5-smoke-topic", questionId: "stage5-q-open", prompt: "OTHER_USER_ONLY", userAnswer: "0", correctAnswer: "1", explanation: "1", status: "OPEN" },
    ],
  });

  await prisma.reviewSchedule.createMany({
    data: [
      { id: "sm-r-overdue", userId: "stage5-smoke", topicId: "stage5-smoke-topic", dueKey: addDateKeys(today, -3), intervalDays: 1, priority: 2, status: "PENDING" },
      { id: "sm-r-today", userId: "stage5-smoke", topicId: "stage5-smoke-topic", dueKey: today, intervalDays: 7, priority: 0, status: "PENDING" },
      { id: "sm-r-future", userId: "stage5-smoke", topicId: "stage5-smoke-topic", dueKey: addDateKeys(today, 7), intervalDays: 30, priority: 0, status: "PENDING" },
      { id: "sm-r-draft", userId: "stage5-smoke", topicId: "stage5-draft-topic", dueKey: today, intervalDays: 1, priority: 0, status: "PENDING" },
    ],
  });

  await prisma.userTopicProgress.create({ data: { userId: "stage5-smoke", topicId: "stage5-smoke-topic", status: "NEEDS_REVIEW" } });

  await prisma.examResult.create({
    data: {
      userId: "stage5-smoke",
      subjectId: "math",
      date: new Date(),
      testType: "MANUAL",
      title: "ZNO self report QA",
      source: "ZNO_ONLINE · SELF_REPORTED",
      rawScore: 20,
      maxRawScore: 32,
      ratingScore: 150,
      belowThreshold: false,
      partial: false,
      countsTowardAverage: false,
      comment: "QA only",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
