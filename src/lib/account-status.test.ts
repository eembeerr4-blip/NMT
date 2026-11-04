import { describe, expect, it } from "vitest";
import { accountStatus, canAccessLearning } from "./account-status";

describe("accountStatus", () => {
  it("treats the platform owner as always approved", () => {
    expect(accountStatus({ id: "owner", accountStatus: "PENDING" })).toBe("APPROVED");
  });

  it("blocks pending and rejected learners from learning access", () => {
    expect(canAccessLearning({ accountStatus: "PENDING" })).toBe(false);
    expect(canAccessLearning({ accountStatus: "REJECTED" })).toBe(false);
    expect(canAccessLearning({ accountStatus: "APPROVED" })).toBe(true);
  });
});
