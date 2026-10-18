import { expect, it } from "vitest";
import { fitDailyLoad } from "./fit-daily-load";

it("fits a 150-minute plan into a selected 75-minute day", () => {
  expect(fitDailyLoad([{ durationMin: 90 }, { durationMin: 60 }], 75).map((slot) => slot.durationMin)).toEqual([45, 30]);
});
it("preserves a shorter plan and rest slots", () => {
  expect(fitDailyLoad([{ durationMin: 0 }, { durationMin: 20 }], 75)).toEqual([{ durationMin: 0 }, { durationMin: 20 }]);
});
it("keeps rounding within the selected total", () => {
  expect(fitDailyLoad([{ durationMin: 75 }, { durationMin: 60 }], 61).reduce((sum, slot) => sum + slot.durationMin, 0)).toBe(61);
});
