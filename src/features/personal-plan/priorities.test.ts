import { describe, expect, it } from "vitest";
import { distributeStudyPriorities, priorityExplanation } from "./priorities";

describe("personal study priorities", () => {
  it("allocates exactly 100 percent and keeps every active subject represented", () => {
    const priorities = distributeStudyPriorities([
      { subjectId: "ukrainian", currentRating: null, targetRating: 170, confirmedErrors: 0 },
      { subjectId: "math", currentRating: 120, targetRating: 170, confirmedErrors: 3 },
      { subjectId: "history", currentRating: 150, targetRating: 170, confirmedErrors: 0 },
      { subjectId: "biology", currentRating: null, targetRating: null, confirmedErrors: 6 },
    ]);
    expect(priorities.reduce((total, item) => total + item.percent, 0)).toBe(100);
    expect(priorities).toHaveLength(4);
    expect(priorities.every((item) => item.percent > 0)).toBe(true);
    expect(priorities.find((item) => item.subjectId === "math")!.percent)
      .toBeGreaterThan(priorities.find((item) => item.subjectId === "ukrainian")!.percent);
  });

  it("does not invent a gap when a baseline result is unknown", () => {
    const [unknown] = distributeStudyPriorities([
      { subjectId: "biology", currentRating: null, targetRating: 180, confirmedErrors: 0 },
      { subjectId: "math", currentRating: 150, targetRating: 180, confirmedErrors: 0 },
    ]);
    expect(unknown.currentRating).toBeNull();
    expect(priorityExplanation(unknown, [unknown])).toBeNull();
  });

  it("explains only a genuine largest known score gap", () => {
    const priorities = distributeStudyPriorities([
      { subjectId: "math", currentRating: 120, targetRating: 170, confirmedErrors: 0 },
      { subjectId: "history", currentRating: 150, targetRating: 170, confirmedErrors: 0 },
    ]);
    expect(priorityExplanation(priorities[0], priorities)).toContain("50 балів");
    expect(priorityExplanation(priorities[1], priorities)).toBeNull();
  });
});
