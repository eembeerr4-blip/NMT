import { describe, expect, it } from "vitest";
import { buildPersonalizedSchedule } from "./schedule";
import { distributeStudyPriorities } from "./priorities";

describe("personalized schedule generation", () => {
  it("uses only active weekdays and allocates each day's selected minutes", () => {
    const priorities = distributeStudyPriorities([
      { subjectId: "ukrainian", currentRating: 150, targetRating: 180, confirmedErrors: 0 },
      { subjectId: "math", currentRating: 120, targetRating: 180, confirmedErrors: 2 },
      { subjectId: "history", currentRating: null, targetRating: 175, confirmedErrors: 0 },
      { subjectId: "biology", currentRating: 155, targetRating: 180, confirmedErrors: 1 },
    ]);
    const schedule = buildPersonalizedSchedule({ priorities, dailyMinutes: 95, studyDays: [1, 3, 5] });
    expect(Object.keys(schedule.days).sort()).toEqual(["1", "3", "5"]);
    for (const day of Object.values(schedule.days)) {
      expect(day.reduce((total, slot) => total + slot.durationMin, 0)).toBe(95);
    }
    expect(new Set(Object.values(schedule.days).flat().map((slot) => slot.subjectId))).toEqual(
      new Set(["ukrainian", "math", "history", "biology"]),
    );
  });

  it("rejects schedules that could exclude active subjects or exceed the supported load", () => {
    const priorities = distributeStudyPriorities([
      { subjectId: "ukrainian", currentRating: null, targetRating: null, confirmedErrors: 0 },
      { subjectId: "math", currentRating: null, targetRating: null, confirmedErrors: 0 },
      { subjectId: "history", currentRating: null, targetRating: null, confirmedErrors: 0 },
      { subjectId: "biology", currentRating: null, targetRating: null, confirmedErrors: 0 },
    ]);
    expect(() => buildPersonalizedSchedule({ priorities, dailyMinutes: 30, studyDays: [1] })).toThrow(/щонайменше/);
    expect(() => buildPersonalizedSchedule({ priorities, dailyMinutes: 300, studyDays: [1, 2] })).toThrow(/від 30 до 240/);
  });
});
