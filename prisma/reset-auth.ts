import { PrismaClient } from "@prisma/client";
import { DEFAULT_FORMAT, REQUIRED_SUBJECT_IDS } from "../src/lib/constants";
import { writeSecrets } from "../src/lib/secrets";

const prisma = new PrismaClient();
const OWNER = "owner";

async function deleteUserSpecificRows() {
  const tables = [
    "session",
    "userSubject",
    "userTopicProgress",
    "userVideoProgress",
    "studyTask",
    "studySession",
    "testAttempt",
    "reviewSchedule",
    "mistake",
    "achievement",
    "xpEvent",
    "note",
    "flashcard",
    "examResult",
    "userSettings",
  ] as const;

  for (const table of tables) {
    if (table === "userSettings") {
      await (prisma[table] as unknown as { deleteMany(args: { where: { userId: { not: string } } }): Promise<unknown> }).deleteMany({ where: { userId: { not: OWNER } } });
      continue;
    }

    if (table === "note" || table === "flashcard" || table === "achievement" || table === "xpEvent" || table === "examResult" || table === "studySession" || table === "reviewSchedule" || table === "mistake" || table === "studyTask" || table === "testAttempt" || table === "userTopicProgress" || table === "userVideoProgress" || table === "userSubject") {
      await (prisma[table] as unknown as { deleteMany(args: { where: { userId: { not: string } } }): Promise<unknown> }).deleteMany({ where: { userId: { not: OWNER } } });
      continue;
    }

    await (prisma[table] as unknown as { deleteMany(args: { where: { userId: { not: string } } }): Promise<unknown> }).deleteMany({ where: { userId: { not: OWNER } } });
  }
}

async function main() {
  await deleteUserSpecificRows();
  await prisma.user.deleteMany({ where: { id: { not: OWNER } } });

  await prisma.user.upsert({
    where: { id: OWNER },
    update: {
      firstName: "Власник",
      lastName: "",
      nickname: "owner",
      role: "ADMIN",
      onboarded: false,
      passwordHash: "",
      examYear: 2027,
    },
    create: {
      id: OWNER,
      firstName: "Власник",
      lastName: "",
      nickname: "owner",
      role: "ADMIN",
      onboarded: false,
      passwordHash: "",
      examYear: 2027,
    },
  });

  await prisma.userSettings.upsert({
    where: { id: "default" },
    update: {
      userId: OWNER,
      theme: "system",
      examDate: null,
      targetScore: 150,
      masteryHighMin: 10,
      masteryMidMin: 7,
      aiProvider: "none",
      aiModel: "",
      mathPriority: 35,
      ukrainianPriority: 25,
      historyPriority: 20,
      biologyPriority: 20,
      timerEnabled: true,
      scheduleJson: "{}",
      formatJson: JSON.stringify(DEFAULT_FORMAT),
      planStart: "2026-10-19",
      dailyMinutes: 150,
      intensity: "standard",
      preferredTime: "18:00",
      studyDaysJson: "[0,1,2,3,4,5,6]",
    },
    create: {
      id: "default",
      userId: OWNER,
      theme: "system",
      examDate: null,
      targetScore: 150,
      masteryHighMin: 10,
      masteryMidMin: 7,
      aiProvider: "none",
      aiModel: "",
      mathPriority: 35,
      ukrainianPriority: 25,
      historyPriority: 20,
      biologyPriority: 20,
      timerEnabled: true,
      scheduleJson: "{}",
      formatJson: JSON.stringify(DEFAULT_FORMAT),
      planStart: "2026-10-19",
      dailyMinutes: 150,
      intensity: "standard",
      preferredTime: "18:00",
      studyDaysJson: "[0,1,2,3,4,5,6]",
    },
  });

  for (const subjectId of REQUIRED_SUBJECT_IDS) {
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: OWNER, subjectId } },
      update: { role: "REQUIRED", active: true },
      create: { userId: OWNER, subjectId, role: "REQUIRED", active: true },
    });
  }

  await prisma.userSubject.upsert({
    where: { userId_subjectId: { userId: OWNER, subjectId: "biology" } },
    update: { role: "ELECTIVE", active: true },
    create: { userId: OWNER, subjectId: "biology", role: "ELECTIVE", active: true },
  });

  await prisma.aIMessage.deleteMany();
  await prisma.aIConversation.deleteMany();

  writeSecrets({
    openaiApiKey: "",
    geminiApiKey: "",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    youtubeApiKey: "",
  });

  const users = await prisma.user.findMany({ select: { id: true, nickname: true, role: true } });
  console.log("Remaining users:", users);
  console.log("Auth reset complete. Owner is ready for first login.");
}

main().then(async () => {
  await prisma.$disconnect();
}).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
