import { expect, it } from "vitest";
import { SUBJECTS } from "./constants";
import { subjectIdSchema } from "./validators";

it("accepts every subject offered by the platform forms", () => {
  for (const subject of SUBJECTS) expect(subjectIdSchema.safeParse(subject.id).success, subject.id).toBe(true);
});

it("rejects an unknown subject", () => {
  expect(subjectIdSchema.safeParse("nonexistent-subject").success).toBe(false);
});
