import { learningStatus, reviewIntervals } from "@/lib/mastery";
import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE } from "./constants";
import { gradeAnswer, stableShuffle } from "./grade";
import { relocationMode } from "./shift";
import { mockSubjectForDate } from "./plan";
import {
  averageForSubject,
  averageOfLatestFull,
  changeFromInitial,
  changeFromPrevious,
  computeStreak,
  convertRawToRating,
  masteryDecision,
  weekCompletion,
} from "./scoring";
import { parseYouTubeId } from "./youtube";

const points = [
  { subjectId: "math", date: "2026-09-01", ratingScore: null, partial: false, belowThreshold: true, countsTowardAverage: false },
  { subjectId: "ukrainian", date: "2026-09-02", ratingScore: 134, partial: false, belowThreshold: false, countsTowardAverage: true },
  { subjectId: "history", date: "2026-09-03", ratingScore: 138, partial: false, belowThreshold: false, countsTowardAverage: true },
  { subjectId: "biology", date: "2026-09-03", ratingScore: 147, partial: false, belowThreshold: false, countsTowardAverage: true },
  { subjectId: "math", date: "2026-09-30", ratingScore: 132, partial: false, belowThreshold: false, countsTowardAverage: true },
  { subjectId: "history", date: "2026-10-02", ratingScore: null, partial: true, belowThreshold: false, countsTowardAverage: false },
  { subjectId: "biology", date: "2026-10-03", ratingScore: 149, partial: false, belowThreshold: false, countsTowardAverage: true },
];

describe("рейтингові розрахунки", () => {
  const subjects = ["math", "ukrainian", "history", "biology"];

  it("рахує середнє останніх повних результатів чотирьох предметів", () => {
    expect(averageOfLatestFull(points, subjects).value).toBe(138.3);
  });

  it("не включає частковий тест історії до середнього предмета", () => {
    expect(averageForSubject(points, "history").value).toBe(138);
  });

  it("показує зміну біології від першого результату", () => {
    expect(changeFromInitial(points, "biology").value).toBe(2);
    expect(changeFromPrevious(points, "biology").value).toBe(2);
  });

  it("не вигадує зміну, якщо рейтинговий бал лише один", () => {
    expect(changeFromInitial(points, "math").label).toBe("Недостатньо даних");
  });

  it("не конвертує бал без офіційної таблиці", () => {
    expect(convertRawToRating({}, 2027, "math", 20)).toBeNull();
    expect(convertRawToRating({ "2025": { math: [{ raw: 20, rating: 160 }] } }, 2025, "math", 20)).toBe(160);
  });
});

describe("засвоєння, серія і план", () => {
  it("застосовує пороги 10 і 7 для тесту з 12 завдань", () => {
    expect(masteryDecision(10, 12, 10, 7)).toBe("MASTERED");
    expect(masteryDecision(8, 12, 10, 7)).toBe("NEEDS_REVIEW");
    expect(masteryDecision(6, 12, 10, 7)).toBe("REPEAT_THEORY");
  });

  it("не карає пропущену неділю", () => {
    expect(computeStreak(["2026-10-16", "2026-10-17"], "2026-10-19")).toBe(2);
  });

  it("рахує відсоток тижня без недільного відпочинку", () => {
    expect(weekCompletion([
      { status: "DONE", durationMin: 90, optional: false, kind: "study" },
      { status: "PLANNED", durationMin: 60, optional: false, kind: "study" },
      { status: "PLANNED", durationMin: 0, optional: true, kind: "rest" },
    ])).toBe(60);
  });

  it("ротація пробників починається з математики 24 жовтня 2026", () => {
    expect(mockSubjectForDate("2026-10-17", DEFAULT_SCHEDULE)).toBeUndefined();
    expect(mockSubjectForDate("2026-10-24", DEFAULT_SCHEDULE)).toBe("math");
    expect(mockSubjectForDate("2026-10-31", DEFAULT_SCHEDULE)).toBe("ukrainian");
  });
});

describe("оцінювання відповідей і YouTube", () => {
  it("не зараховує відмінне формулювання короткої відповіді як помилку", () => {
    const result = gradeAnswer({ type: "SHORT_TEXT", correctAnswer: "м'ята", userAnswer: "м’ята  " });
    expect(result.isCorrect).toBe(true);
    const review = gradeAnswer({ type: "SHORT_TEXT", correctAnswer: "м'ята", userAnswer: "м'ята перцева" });
    expect(review.needsManualReview).toBe(true);
    expect(review.isCorrect).toBeNull();
  });

  it("приймає десяткову кому в числовій відповіді", () => {
    expect(gradeAnswer({ type: "NUMERIC", correctAnswer: "5", userAnswer: "5,0" }).isCorrect).toBe(true);
  });

  it("перевіряє кінцеве число в покроковій задачі", () => {
    expect(gradeAnswer({ type: "STEP_BY_STEP", correctAnswer: "4", userAnswer: { work: "хід", final: "4" } }).isCorrect).toBe(true);
  });

  it("повторне перенесення оновлює те саме заняття", () => {
  expect(relocationMode({ templateKey: "d1-s0", movedFromId: null })).toBe("successor");
  expect(relocationMode({ templateKey: "moved-abc", movedFromId: "abc" })).toBe("update");
});

  it("перемішує послідовність стабільно і не залишає правильний порядок за замовчуванням", () => {
    const original = ["q-m7-1", "q-m7-2", "q-m7-3"];
    const first = stableShuffle(original, "attempt:q-m7");
    expect(first).toEqual(stableShuffle(original, "attempt:q-m7"));
    expect(first.join()).not.toBe(original.join());
  });

  it("читає ідентифікатор YouTube і відхиляє довільний текст", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("javascript:alert(1)")).toBeNull();
    expect(parseYouTubeId("канал Історія України")).toBeNull();
  });

  it("скорочує повторення після помилок і подовжує його після засвоєння", () => {
    expect(reviewIntervals(4, 12, 10, 7, 3)).toEqual([1, 3, 7]);
    expect(reviewIntervals(8, 12, 10, 7, 0)).toEqual([1, 7, 30]);
    expect(reviewIntervals(11, 12, 10, 7, 0)).toEqual([7, 21, 45]);
    expect(learningStatus(11, 12, 10, 7)).toBe("MASTERED");
    expect(learningStatus(3, 12, 10, 7)).toBe("IN_PROGRESS");
  });
});
