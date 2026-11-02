import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPasswordAsync } from "../src/lib/auth";

const QA_DB = path.join(process.cwd(), "prisma", "stage6-final-qa.db");
const PASSWORD = "stage6-qa-pass-2026";
const TOPICS = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

async function fingerprint(p: PrismaClient, table: string) {
  const countRows = await p.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*) as c FROM "${table}"`);
  const count = Number(countRows[0].c);
  if (count === 0) return { count, hash: "empty" };
  const rows = await p.$queryRawUnsafe<{ blob: string }[]>(
    `SELECT group_concat(rowid || ':' || quote(rowid), '|') as blob FROM "${table}" ORDER BY rowid`,
  );
  const hash = createHash("sha256").update(rows[0]?.blob ?? "").digest("hex");
  return { count, hash };
}

async function main() {
  const url = `file:${QA_DB.replaceAll("\\", "/")}?connection_limit=1`;
  const p = new PrismaClient({ datasources: { db: { url } } });
  const passwordHash = await hashPasswordAsync(PASSWORD);
  for (const [nickname, role] of [
    ["stage6_qa_editor", "EDITOR"],
    ["stage6_qa_student", "STUDENT"],
  ] as const) {
    await p.user.upsert({
      where: { nickname },
      create: {
        nickname,
        role,
        firstName: nickname,
        passwordHash,
        onboarded: true,
        accountStatus: "APPROVED",
        email: `${nickname}@qa.local`,
        emailVerifiedAt: new Date(),
      },
      update: { role, passwordHash, accountStatus: "APPROVED", onboarded: true, emailVerifiedAt: new Date() },
    });
  }
  const subjectIds = await p.topic.findMany({
    where: { id: { in: TOPICS } },
    select: { subjectId: true },
    distinct: ["subjectId"],
  });
  const editor = await p.user.findUniqueOrThrow({ where: { nickname: "stage6_qa_editor" } });
  const student = await p.user.findUniqueOrThrow({ where: { nickname: "stage6_qa_student" } });
  const template = await p.userSettings.findUnique({ where: { id: "default" } });
  for (const userId of [editor.id, student.id]) {
    const existing = await p.userSettings.findUnique({ where: { userId } });
    if (existing) continue;
    if (template) {
      await p.userSettings.create({
        data: {
          id: userId,
          userId,
          theme: template.theme,
          examDate: template.examDate,
          targetScore: template.targetScore,
          masteryHighMin: template.masteryHighMin,
          masteryMidMin: template.masteryMidMin,
          mathPriority: template.mathPriority,
          ukrainianPriority: template.ukrainianPriority,
          historyPriority: template.historyPriority,
          biologyPriority: template.biologyPriority,
          timerEnabled: template.timerEnabled,
          scheduleJson: template.scheduleJson,
          formatJson: template.formatJson,
          planStart: template.planStart,
          dailyMinutes: template.dailyMinutes,
          intensity: template.intensity,
          preferredTime: template.preferredTime,
          studyDaysJson: template.studyDaysJson,
        },
      });
    } else {
      await p.userSettings.create({
        data: {
          id: userId,
          userId,
          scheduleJson: "[]",
          formatJson: "{}",
        },
      });
    }
  }
  for (const { subjectId } of subjectIds) {
    await p.userSubject.upsert({
      where: { userId_subjectId: { userId: editor.id, subjectId } },
      create: { userId: editor.id, subjectId, active: true, role: "EDITOR" },
      update: { active: true },
    });
    await p.userSubject.upsert({
      where: { userId_subjectId: { userId: student.id, subjectId } },
      create: { userId: student.id, subjectId, active: true, role: "STUDENT" },
      update: { active: true },
    });
  }
  await p.topic.updateMany({ where: { id: { in: TOPICS } }, data: { coverage: "DRAFT" } });

  const verified = await p.question.count({ where: { topicId: { in: TOPICS }, verificationStatus: "VERIFIED" } });
  const draftTopics = await p.topic.count({ where: { id: { in: TOPICS }, coverage: "DRAFT" } });
  const fingerprints = {
    TestAttempt: await fingerprint(p, "TestAttempt"),
    Answer: await fingerprint(p, "Answer"),
    StudyTask: await fingerprint(p, "StudyTask"),
    Mistake: await fingerprint(p, "Mistake"),
    ReviewSchedule: await fingerprint(p, "ReviewSchedule"),
  };

  console.log(
    JSON.stringify(
      {
        qaDb: QA_DB,
        verified,
        draftTopics,
        editor: editor.nickname,
        student: student.nickname,
        passwordHint: PASSWORD,
        fingerprints,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
}

main();
