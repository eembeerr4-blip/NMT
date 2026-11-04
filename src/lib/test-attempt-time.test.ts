import { describe, expect, it } from "vitest";
import { ATTEMPT_FINISH_GRACE_SEC, canFinishAttemptAfterDeadline, isAttemptExpired } from "./test-attempt-time";

const started = new Date("2026-10-22T12:00:00.000Z");

describe("test attempt time limits", () => {
  it("treats unlimited attempts as never expired", () => {
    expect(isAttemptExpired(started, null)).toBe(false);
    expect(isAttemptExpired(started, 0)).toBe(false);
    expect(canFinishAttemptAfterDeadline(started, null)).toBe(true);
  });

  it("expires after the configured limit", () => {
    const limit = 600;
    const before = started.getTime() + limit * 1000 - 1;
    const after = started.getTime() + limit * 1000 + 1;
    expect(isAttemptExpired(started, limit, before)).toBe(false);
    expect(isAttemptExpired(started, limit, after)).toBe(true);
  });

  it("allows finish only within grace after the limit", () => {
    const limit = 60;
    const deadline = started.getTime() + limit * 1000;
    expect(canFinishAttemptAfterDeadline(started, limit, deadline + 1000)).toBe(true);
    expect(canFinishAttemptAfterDeadline(started, limit, deadline + ATTEMPT_FINISH_GRACE_SEC * 1000)).toBe(true);
    expect(canFinishAttemptAfterDeadline(started, limit, deadline + ATTEMPT_FINISH_GRACE_SEC * 1000 + 1)).toBe(false);
  });
});
