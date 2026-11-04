import { expect, it } from "vitest";
import { reviewPriorityLabel } from "@/lib/mistake-review-ui";

it("labels elevated review priority only when data says so", () => {
  expect(reviewPriorityLabel(0)).toBe("");
  expect(reviewPriorityLabel(1)).toBe("");
  expect(reviewPriorityLabel(2)).toBe("Високий пріоритет");
});
