import { DEFAULT_SCHEDULE, SUBJECTS, type ScheduleConfig, type SubjectId } from "@/lib/constants";
import { addDateKeys, dateKey, daysBetween, parseDateKey } from "@/lib/dates";

export type TopicPick = {
  id: string;
  subjectId: string;
  title: string;
  status: string;
  sortOrder: number;
  parentId: string | null;
};

export type PlannedSlot = {
  dateKey: string;
  templateKey: string;
  subjectId?: string;
  title: string;
  detail: string;
  kind: string;
  durationMin: number;
  optional: boolean;
  sortOrder: number;
  topicId?: string;
};

const subjectName = new Map(SUBJECTS.map((subject) => [subject.id, subject.name]));

export function personalSchedule(electiveId: string, intensity: "light" | "standard" | "intense" = "standard"): ScheduleConfig {
  const factor = intensity === "light" ? 0.7 : intensity === "intense" ? 1.25 : 1;
  const days = Object.fromEntries(Object.entries(DEFAULT_SCHEDULE.days).map(([day, slots]) => [
    day,
    slots.map((slot) => ({
      ...slot,
      subjectId: slot.subjectId === "biology" ? electiveId as SubjectId : slot.subjectId,
      durationMin: Math.round(slot.durationMin * factor),
    })),
  ]));
  return {
    anchorMockDate: DEFAULT_SCHEDULE.anchorMockDate,
    rotation: ["math", "ukrainian", "history", electiveId as SubjectId],
    days,
  };
}

export function mockSubjectForDate(date: string, schedule: ScheduleConfig): SubjectId | undefined {
  if (date < schedule.anchorMockDate) return undefined;
  const index = Math.floor(daysBetween(schedule.anchorMockDate, date) / 7);
  const rotation = schedule.rotation;
  return rotation[((index % rotation.length) + rotation.length) % rotation.length];
}

export function nextTopicForSubject(topics: TopicPick[], subjectId: string) {
  const leaves = topics
    .filter((topic) => topic.subjectId === subjectId)
    .filter((topic) => !topics.some((child) => child.parentId === topic.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    leaves.find((topic) => topic.status === "IN_PROGRESS") ??
    leaves.find((topic) => topic.status === "NEEDS_REVIEW") ??
    leaves.find((topic) => topic.status === "NOT_STARTED") ??
    leaves.find((topic) => topic.status !== "MASTERED") ??
    null
  );
}

export function buildSlotsForDate(date: string, schedule: ScheduleConfig, topics: TopicPick[], planStart: string): PlannedSlot[] {
  if (date < planStart) return [];
  const weekday = String(parseDateKey(date).getDay());
  const slots = schedule.days[weekday] ?? [];
  return slots.map((slot) => {
    const templateKey = `d${weekday}-s${slot.slot}`;
    if (slot.kind === "mock") {
      const subjectId = mockSubjectForDate(date, schedule);
      const name = subjectId ? subjectName.get(subjectId) : undefined;
      return {
        dateKey: date,
        templateKey,
        subjectId,
        title: name ? `Пробник: ${name}` : slot.title,
        detail: subjectId ? "Повний пробник за ротацією. Рейтинг не вигадується автоматично." : "Дата ще до першого пробника.",
        kind: slot.kind,
        durationMin: slot.durationMin,
        optional: Boolean(slot.optional),
        sortOrder: slot.slot,
      };
    }
    if (slot.kind === "study" && slot.subjectId) {
      const topic = nextTopicForSubject(topics, slot.subjectId);
      return {
        dateKey: date,
        templateKey,
        subjectId: slot.subjectId,
        topicId: topic?.id,
        title: `${subjectName.get(slot.subjectId) ?? slot.title}${topic ? ` — ${topic.title}` : ""}`,
        detail: topic ? "Лекція, конспект і тематичний тест." : "Оберіть тему вручну.",
        kind: slot.kind,
        durationMin: slot.durationMin,
        optional: Boolean(slot.optional),
        sortOrder: slot.slot,
      };
    }
    return {
      dateKey: date,
      templateKey,
      subjectId: slot.subjectId,
      title: slot.title,
      detail: slot.kind === "rest" ? "Неділя не перериває серію навчальних днів." : slot.kind === "analysis" ? "Розберіть помилки пробника." : "Необов'язкове коротке повторення.",
      kind: slot.kind,
      durationMin: slot.durationMin,
      optional: Boolean(slot.optional),
      sortOrder: slot.slot,
    };
  });
}

export function eachDate(from: string, to: string) {
  const keys: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    keys.push(cursor);
    cursor = addDateKeys(cursor, 1);
  }
  return keys;
}

export function windowFor(today = dateKey(new Date()), planStart = "2026-10-19") {
  const from = today < planStart ? planStart : addDateKeys(today, -14);
  const start = from < planStart ? planStart : from;
  return { from: start, to: addDateKeys(today < planStart ? planStart : today, 42) };
}
