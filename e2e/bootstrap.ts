import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE, REQUIRED_SUBJECT_IDS } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.includes("e2e.db")) throw new Error("bootstrap лише для e2e.db");
  await prisma.user.update({
    where: { id: "owner" },
    data: { passwordHash: hashPassword("test-pass-2027"), onboarded: true, firstName: "Тест", accountStatus: "APPROVED" },
  });
  await prisma.user.upsert({
    where: { id: "e2e_student" },
    update: { passwordHash: hashPassword("test-pass-2027"), onboarded: true, diagnosticSkipped: true, accountStatus: "APPROVED", role: "STUDENT" },
    create: {
      id: "e2e_student",
      nickname: "e2e_student",
      firstName: "E2E",
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: true,
      diagnosticSkipped: true,
      examYear: 2027,
      accountStatus: "APPROVED",
      role: "STUDENT",
    },
  });
  await prisma.user.upsert({
    where: { id: "e2e_student_b" },
    update: { passwordHash: hashPassword("test-pass-2027"), onboarded: true, diagnosticSkipped: true, accountStatus: "APPROVED", role: "STUDENT" },
    create: {
      id: "e2e_student_b",
      nickname: "e2e_student_b",
      firstName: "E2E-B",
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: true,
      diagnosticSkipped: true,
      examYear: 2027,
      accountStatus: "APPROVED",
      role: "STUDENT",
    },
  });
  await prisma.user.upsert({
    where: { id: "e2e_admin" },
    update: { passwordHash: hashPassword("test-pass-2027"), onboarded: true, diagnosticSkipped: true, accountStatus: "APPROVED", role: "ADMIN" },
    create: {
      id: "e2e_admin",
      nickname: "e2e_admin",
      firstName: "E2E-Admin",
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: true,
      diagnosticSkipped: true,
      examYear: 2027,
      accountStatus: "APPROVED",
      role: "ADMIN",
    },
  });
  await prisma.user.upsert({
    where: { id: "e2e_editor" },
    update: { passwordHash: hashPassword("test-pass-2027"), onboarded: true, diagnosticSkipped: true, accountStatus: "APPROVED", role: "EDITOR" },
    create: {
      id: "e2e_editor",
      nickname: "e2e_editor",
      firstName: "E2E-Editor",
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: true,
      diagnosticSkipped: true,
      examYear: 2027,
      accountStatus: "APPROVED",
      role: "EDITOR",
    },
  });
  await prisma.user.upsert({
    where: { id: "e2e_pending" },
    update: {
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: false,
      accountStatus: "PENDING",
      email: "e2e-pending@example.test",
      emailVerifiedAt: new Date("2026-10-22T12:00:00.000Z"),
    },
    create: {
      id: "e2e_pending",
      nickname: "e2e_pending",
      firstName: "Очікує",
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: false,
      accountStatus: "PENDING",
      email: "e2e-pending@example.test",
      emailVerifiedAt: new Date("2026-10-22T12:00:00.000Z"),
      examYear: 2027,
    },
  });
  await prisma.user.upsert({
    where: { id: "e2e_pending_guard" },
    update: {
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: false,
      accountStatus: "PENDING",
      email: "e2e-pending-guard@example.test",
      emailVerifiedAt: new Date("2026-10-22T12:00:00.000Z"),
    },
    create: {
      id: "e2e_pending_guard",
      nickname: "e2e_pending_guard",
      firstName: "Очікує",
      passwordHash: hashPassword("test-pass-2027"),
      onboarded: false,
      accountStatus: "PENDING",
      email: "e2e-pending-guard@example.test",
      emailVerifiedAt: new Date("2026-10-22T12:00:00.000Z"),
      examYear: 2027,
    },
  });
  for (const studentId of ["e2e_student", "e2e_student_b", "e2e_admin", "e2e_editor"] as const) {
    await prisma.userSettings.upsert({
      where: { userId: studentId },
      update: {},
      create: {
        id: studentId,
        userId: studentId,
        scheduleJson: JSON.stringify(DEFAULT_SCHEDULE),
        formatJson: JSON.stringify(DEFAULT_FORMAT),
      },
    });
    for (const subjectId of REQUIRED_SUBJECT_IDS) {
      await prisma.userSubject.upsert({
        where: { userId_subjectId: { userId: studentId, subjectId } },
        update: {},
        create: { userId: studentId, subjectId, role: "REQUIRED", active: true },
      });
    }
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: studentId, subjectId: "biology" } },
      update: { active: true, role: "ELECTIVE" },
      create: { userId: studentId, subjectId: "biology", role: "ELECTIVE", active: true },
    });
  }
  await prisma.studyTask.upsert({
    where: { userId_dateKey_templateKey: { userId: "owner", dateKey: "2026-10-19", templateKey: "e2e-calendar-move" } },
    update: { title: "E2E перенос заняття", status: "PLANNED", durationMin: 30, kind: "topic" },
    create: {
      id: "e2e-calendar-task",
      userId: "owner",
      dateKey: "2026-10-19",
      templateKey: "e2e-calendar-move",
      title: "E2E перенос заняття",
      kind: "topic",
      durationMin: 30,
      status: "PLANNED",
      sortOrder: 0,
    },
  });
  await prisma.$disconnect();
}

main();
