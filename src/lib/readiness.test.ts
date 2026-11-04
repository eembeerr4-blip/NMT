import { expect, it } from "vitest";
import { lessonReadiness } from "./readiness";
import { parseLesson } from "./lesson";
import { fitDailyLoad } from "./fit-daily-load";

const lesson = {
  objectives: ["Тема"],
  theory: "Пояснення ".repeat(100),
  rules: ["Правило"],
  examples: [
    { task: "1", solution: "1" },
    { task: "2", solution: "2" },
  ],
  mistakes: ["Помилка"],
  summary: "Висновок",
};
const verifiedQuestions = [
  ...Array.from({ length: 4 }, () => ({ difficulty: "EASY", verificationStatus: "VERIFIED" })),
  ...Array.from({ length: 5 }, () => ({ difficulty: "MEDIUM", verificationStatus: "VERIFIED" })),
  ...Array.from({ length: 3 }, () => ({ difficulty: "HARD", verificationStatus: "VERIFIED" })),
];

it("marks a complete lesson ready without confirmed video", () => {
  const topic = { lessonJson: JSON.stringify(lesson), questions: verifiedQuestions, videos: [{ reviewStatus: "SUGGESTED" }] };
  const r = lessonReadiness(topic);
  expect(r.ready).toBe(true);
  expect(r.video).toBe(false);
  expect(r.practice).toBe(true);
});

it("handles malformed lesson arrays without crashing a page", () => {
  const parsed = parseLesson(
    JSON.stringify({
      ...lesson,
      rules: "bad",
      examples: [null, {}],
      sources: [null, { url: "javascript:alert(1)", title: "invalid" }],
    }),
  );
  expect(parsed?.rules).toEqual([]);
  expect(parsed?.examples).toEqual([]);
  expect(parsed?.sources).toEqual([]);
});

it("does not generate work when the daily budget is exhausted", () => {
  expect(fitDailyLoad([{ durationMin: 30 }], 0)).toEqual([]);
});
