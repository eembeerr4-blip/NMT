import { describe, expect, it } from "vitest";
import { SUBJECTS } from "./constants";
import { examResultSchema, subjectIdSchema } from "./validators";

describe("subject validators", () => {
  it("accepts every supported NMT subject for recorded exam results", () => {
    for (const subject of SUBJECTS) {
      expect(subjectIdSchema.safeParse(subject.id).success).toBe(true);
      expect(examResultSchema.safeParse({
        subjectId: subject.id,
        date: "2026-10-17",
        testType: "FULL_MOCK",
        title: "Пробний тест",
        source: "",
        rawScore: 20,
        maxRawScore: 30,
        ratingScore: null,
        belowThreshold: false,
        partial: false,
        countsTowardAverage: true,
        durationMin: null,
        errorCount: null,
        comment: "",
      }).success).toBe(true);
    }
  });

  it("rejects subject ids not present in the supported catalog", () => {
    expect(subjectIdSchema.safeParse("unknown").success).toBe(false);
  });
});
