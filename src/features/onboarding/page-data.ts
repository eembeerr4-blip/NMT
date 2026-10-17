import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/session";
import { dateKey } from "@/lib/dates";
import { SUBJECTS } from "@/lib/constants";
import { getOnboardingSubjects } from "./subjects";

const steps = ["PROFILE", "SUBJECTS", "DIAGNOSTIC", "TARGETS", "SCHEDULE", "COMPLETE", "SKIPPED"];

export async function loadOnboardingPageData() {
  const user = await getSessionUser();
  if (user?.onboarded) redirect("/");

  const [databaseSubjects, owner] = await Promise.all([
    prisma.subject.findMany({ select: { id: true } }),
    user ? Promise.resolve(null) : prisma.user.findUnique({ where: { id: "owner" }, select: { passwordHash: true } }),
  ]);
  const supportedIds = new Set(databaseSubjects.map((subject) => subject.id));
  const subjects = getOnboardingSubjects()
    .filter((subject) => supportedIds.has(subject.id))
    .map(({ id, name, shortName, color, role, description }) => ({ id, name, shortName, color, role, description }));

  if (!user) {
    return {
      user: null,
      subjects,
      claimAvailable: Boolean(owner && !owner.passwordHash),
      step: "PROFILE",
      electiveId: null,
      baselines: [],
      targets: {},
      preferences: null,
      diagnosticSkipped: false,
      today: dateKey(),
    };
  }

  const [selected, baselines, settings] = await Promise.all([
    prisma.userSubject.findMany({ where: { userId: user.id, active: true }, select: { subjectId: true, role: true, targetScore: true } }),
    prisma.examResult.findMany({
      where: { userId: user.id, isBaseline: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
  ]);
  const baselineBySubject = new Map<string, (typeof baselines)[number]>();
  for (const result of baselines) {
    if (!baselineBySubject.has(result.subjectId)) baselineBySubject.set(result.subjectId, result);
  }
  const storedStep = steps.includes(user.onboardingStep) ? user.onboardingStep : "SUBJECTS";
  const step = user.id === "owner" && storedStep === "PROFILE" ? "SUBJECTS" : storedStep;

  return {
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, nickname: user.nickname },
    subjects,
    claimAvailable: false,
    step,
    electiveId: selected.find((item) => item.role === "ELECTIVE")?.subjectId ?? null,
    baselines: [...baselineBySubject.values()].map((result) => ({
      id: result.id,
      subjectId: result.subjectId,
      date: result.date.toISOString().slice(0, 10),
      title: result.title,
      ratingScore: result.ratingScore,
      rawScore: result.rawScore,
      maxRawScore: result.maxRawScore,
      belowThreshold: result.belowThreshold,
      partial: result.partial,
      comment: result.comment,
    })),
    targets: selected.reduce<Record<string, number>>((targets, item) => {
      if (item.targetScore !== null) targets[item.subjectId] = item.targetScore;
      return targets;
    }, {}),
    preferences: settings ? {
      dailyMinutes: settings.dailyMinutes,
      studyDays: JSON.parse(settings.studyDaysJson) as number[],
      preferredTime: settings.preferredTime,
      planStart: settings.planStart,
      examDate: settings.examDate?.toISOString().slice(0, 10) ?? "",
    } : null,
    diagnosticSkipped: user.diagnosticSkipped,
    today: dateKey(),
  };
}

export function subjectCatalogName(subjectId: string) {
  return SUBJECTS.find((subject) => subject.id === subjectId)?.name ?? subjectId;
}
