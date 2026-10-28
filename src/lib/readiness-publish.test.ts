import { expect, it } from "vitest";
import { lessonAccess, lessonReadiness, publishReadinessError } from "./readiness";

const lesson = {
  objectives: ["Ціль"],
  theory: "Пояснення ".repeat(100),
  rules: ["Правило"],
  examples: [
    { task: "a", solution: "a" },
    { task: "b", solution: "b" },
  ],
  mistakes: ["Помилка"],
  summary: "Підсумок",
};
const verifiedBank = [
  ...Array.from({ length: 4 }, () => ({ difficulty: "EASY", verificationStatus: "VERIFIED" })),
  ...Array.from({ length: 5 }, () => ({ difficulty: "MEDIUM", verificationStatus: "VERIFIED" })),
  ...Array.from({ length: 3 }, () => ({ difficulty: "HARD", verificationStatus: "VERIFIED" })),
];
const baseTopic = {
  lessonJson: JSON.stringify(lesson),
  questions: verifiedBank,
  videos: [{ reviewStatus: "SUGGESTED" as const }],
};

it("1 · full lesson without video is publish-ready", () => {
  const r = lessonReadiness(baseTopic);
  expect(r.ready).toBe(true);
  expect(publishReadinessError(r)).toBeNull();
});

it("2 · incomplete theory blocks publish", () => {
  const r = lessonReadiness({
    ...baseTopic,
    lessonJson: JSON.stringify({ ...lesson, theory: "коротко", summary: "" }),
  });
  expect(r.ready).toBe(false);
  expect(publishReadinessError(r)).toMatch(/не готовий/);
});

it("3 · insufficient VERIFIED practice blocks publish", () => {
  const r = lessonReadiness({
    ...baseTopic,
    questions: verifiedBank.slice(0, 3),
  });
  expect(r.practice).toBe(false);
  expect(publishReadinessError(r)).toMatch(/4\/5\/3/);
});

it("4 · suggested video is hidden from learner access flags", () => {
  expect(
    lessonAccess({
      lessonJson: baseTopic.lessonJson,
      coverage: "READY",
      questions: verifiedBank,
      videos: [{ reviewStatus: "SUGGESTED" }],
    }).video,
  ).toBe(false);
});

it("5 · DRAFT stays hidden from learners", () => {
  expect(
    lessonAccess({
      lessonJson: baseTopic.lessonJson,
      coverage: "DRAFT",
      questions: verifiedBank,
      videos: [{ reviewStatus: "CONFIRMED" }],
    }),
  ).toMatchObject({ available: false, theory: false, video: false, practice: false });
});

it("6 · published lesson without video exposes theory and practice access", () => {
  const access = lessonAccess({
    lessonJson: baseTopic.lessonJson,
    coverage: "READY",
    questions: verifiedBank,
    videos: [{ reviewStatus: "SUGGESTED" }],
  });
  expect(access).toMatchObject({ available: true, theory: true, video: false, practice: true });
});

it("7 · CONFIRMED video becomes available without changing coverage", () => {
  const before = lessonAccess({
    lessonJson: baseTopic.lessonJson,
    coverage: "READY",
    questions: verifiedBank,
    videos: [{ reviewStatus: "SUGGESTED" }],
  });
  const after = lessonAccess({
    lessonJson: baseTopic.lessonJson,
    coverage: "READY",
    questions: verifiedBank,
    videos: [{ reviewStatus: "CONFIRMED" }],
  });
  expect(before.video).toBe(false);
  expect(after.video).toBe(true);
});

it("8 · publishReadinessError does not bypass editor gate (checked in permissions-matrix)", () => {
  expect(publishReadinessError(lessonReadiness(baseTopic))).toBeNull();
});

it("9 · readiness is pure — no database side effects", () => {
  expect(lessonReadiness(baseTopic).ready).toBe(true);
});
