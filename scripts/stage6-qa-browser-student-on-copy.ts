import { PrismaClient } from "@prisma/client";
import { hashPasswordAsync } from "../src/lib/auth";

const QA_DB = process.env.STAGE6_QA_BROWSER_DB ?? "";
if (!QA_DB) throw new Error("STAGE6_QA_BROWSER_DB required");

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

async function main() {
  const url = `file:${QA_DB.replaceAll("\\", "/")}?connection_limit=1`;
  const p = new PrismaClient({ datasources: { db: { url } } });
  const passwordHash = await hashPasswordAsync(PASSWORD);
  await p.user.upsert({
    where: { nickname: "stage6_qa_student" },
    create: {
      nickname: "stage6_qa_student",
      role: "STUDENT",
      firstName: "Stage6 QA Student",
      passwordHash,
      onboarded: true,
      accountStatus: "APPROVED",
      email: "stage6_qa_student@qa.local",
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, accountStatus: "APPROVED", onboarded: true },
  });
  const student = await p.user.findUniqueOrThrow({ where: { nickname: "stage6_qa_student" } });
  const subjectIds = await p.topic.findMany({ where: { id: { in: TOPICS } }, select: { subjectId: true }, distinct: ["subjectId"] });
  for (const { subjectId } of subjectIds) {
    await p.userSubject.upsert({
      where: { userId_subjectId: { userId: student.id, subjectId } },
      create: { userId: student.id, subjectId, active: true, role: "STUDENT" },
      update: { active: true },
    });
  }
  const ready = await p.topic.count({ where: { id: { in: TOPICS }, coverage: "READY" } });
  console.log(JSON.stringify({ ok: true, student: student.nickname, readyTopics: ready }, null, 2));
  await p.$disconnect();
}

main();
