import { describe, expect, it } from "vitest";
import { isValidNickname, normalizeNickname } from "./nickname";

describe("nickname normalization", () => {
  it("normalizes case, surrounding whitespace and Unicode compatibility forms", () => {
    expect(normalizeNickname("  ＭａｘＵｓｅｒ  ")).toBe("maxuser");
  });

  it("validates the canonical ASCII login identifier", () => {
    expect(isValidNickname("Max_User-1")).toBe(true);
    expect(isValidNickname("no")).toBe(false);
    expect(isValidNickname("ім’я")).toBe(false);
  });
});
