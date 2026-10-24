import { describe, expect, it } from "vitest";
import { ukLessonCount, ukPluralForm } from "./uk-plural";

describe("ukPluralForm", () => {
  it("classifies lesson counts per Ukrainian rules", () => {
    const few = [2, 3, 4, 22, 24, 102];
    const one = [1, 21, 101];
    const many = [0, 5, 11, 12, 14, 25, 100, 112];
    for (const n of few) expect(ukPluralForm(n)).toBe("few");
    for (const n of one) expect(ukPluralForm(n)).toBe("one");
    for (const n of many) expect(ukPluralForm(n)).toBe("many");
  });
});

describe("ukLessonCount", () => {
  it("formats lesson labels", () => {
    expect(ukLessonCount(0)).toBe("0 занять");
    expect(ukLessonCount(1)).toBe("1 заняття");
    expect(ukLessonCount(2)).toBe("2 заняття");
    expect(ukLessonCount(4)).toBe("4 заняття");
    expect(ukLessonCount(5)).toBe("5 занять");
    expect(ukLessonCount(11)).toBe("11 занять");
    expect(ukLessonCount(12)).toBe("12 занять");
    expect(ukLessonCount(14)).toBe("14 занять");
    expect(ukLessonCount(21)).toBe("21 заняття");
    expect(ukLessonCount(22)).toBe("22 заняття");
    expect(ukLessonCount(25)).toBe("25 занять");
    expect(ukLessonCount(101)).toBe("101 заняття");
    expect(ukLessonCount(112)).toBe("112 занять");
  });
});
