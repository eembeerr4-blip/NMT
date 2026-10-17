import { DEFAULT_SCHEDULE, SUBJECTS, type ScheduleConfig, type SubjectId } from "@/lib/constants";
import { PERSONAL_PLAN_CONFIG } from "./config";
import type { SubjectPriority } from "./priorities";

const subjectNames = new Map(SUBJECTS.map((subject) => [subject.id, subject.name]));

export function buildPersonalizedSchedule(input: {
  priorities: SubjectPriority[];
  dailyMinutes: number;
  studyDays: number[];
}): ScheduleConfig {
  const subjectIds: SubjectId[] = input.priorities.map((item) => {
    const subject = SUBJECTS.find((candidate) => candidate.id === item.subjectId);
    if (!subject) throw new Error("Розклад містить невідомий предмет.");
    return subject.id;
  });
  if (subjectIds.length !== 4 || new Set(subjectIds).size !== 4) {
    throw new Error("Персональний розклад потребує чотирьох різних активних предметів.");
  }
  const config = PERSONAL_PLAN_CONFIG.schedule;
  if (!Number.isInteger(input.dailyMinutes) || input.dailyMinutes < config.minimumDailyMinutes || input.dailyMinutes > config.maximumDailyMinutes) {
    throw new Error(`Щоденне навчальне навантаження має бути від ${config.minimumDailyMinutes} до ${config.maximumDailyMinutes} хвилин.`);
  }
  const studyDays = [...new Set(input.studyDays)].sort((a, b) => a - b);
  if (studyDays.length < config.minimumStudyDays || studyDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error(`Оберіть щонайменше ${config.minimumStudyDays} коректні навчальні дні.`);
  }

  const slotsPerDay = Math.min(
    config.maximumBlocksPerStudyDay,
    Math.max(config.minimumBlocksPerStudyDay, Math.floor(input.dailyMinutes / config.minutesPerBlock)),
  );
  const totalSlots = slotsPerDay * studyDays.length;
  const slotCounts = allocateSlots(input.priorities, totalSlots);
  const orderedSubjects = interleaveSlots(input.priorities, slotCounts);
  const durationBase = Math.floor(input.dailyMinutes / slotsPerDay);
  const extraMinutes = input.dailyMinutes % slotsPerDay;
  const days: ScheduleConfig["days"] = {};

  let cursor = 0;
  for (const day of studyDays) {
    days[String(day)] = Array.from({ length: slotsPerDay }, (_, slot) => {
      const priority = orderedSubjects[cursor++];
      const scheduledSubject = SUBJECTS.find((subject) => subject.id === priority.subjectId);
      if (!scheduledSubject) throw new Error("Розклад містить невідомий предмет.");
      const subjectId = scheduledSubject.id;
      return {
        slot,
        subjectId,
        title: subjectNames.get(subjectId as SubjectId) ?? subjectId,
        durationMin: durationBase + (slot < extraMinutes ? 1 : 0),
        kind: "study" as const,
      };
    });
  }

  return {
    anchorMockDate: DEFAULT_SCHEDULE.anchorMockDate,
    rotation: subjectIds,
    days,
  };
}

function allocateSlots(priorities: SubjectPriority[], totalSlots: number) {
  const available = totalSlots - priorities.length;
  const exact = priorities.map((priority) => (priority.percent / 100) * available);
  const extras = exact.map(Math.floor);
  let remaining = available - extras.reduce((sum, value) => sum + value, 0);
  const fractions = exact
    .map((value, index) => ({ index, fraction: value - extras[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let index = 0; remaining > 0; index += 1, remaining -= 1) {
    extras[fractions[index % fractions.length].index] += 1;
  }
  return priorities.map((priority, index) => ({ ...priority, slots: extras[index] + 1 }));
}

function interleaveSlots(
  priorities: SubjectPriority[],
  allocations: Array<SubjectPriority & { slots: number }>,
) {
  const remaining = allocations.map((allocation) => allocation.slots);
  const ordered: SubjectPriority[] = [];
  const totalSlots = remaining.reduce((sum, slots) => sum + slots, 0);
  let previous = -1;

  while (ordered.length < totalSlots) {
    const candidates = priorities
      .map((priority, index) => ({ priority, index, remaining: remaining[index] }))
      .filter((item) => item.remaining > 0 && (item.index !== previous || remaining.filter((count) => count > 0).length === 1))
      .sort((a, b) => b.remaining - a.remaining || a.index - b.index);
    const selected = candidates[0];
    if (!selected) throw new Error("Не вдалося розподілити навчальні заняття.");
    ordered.push(selected.priority);
    remaining[selected.index] -= 1;
    previous = selected.index;
  }

  return ordered;
}
