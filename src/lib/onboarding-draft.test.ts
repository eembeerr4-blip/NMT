import { expect, it } from "vitest";
import { parseOnboardingDraft, serializeOnboardingDraft } from "./onboarding-draft";

it("restores the step and learning choices without persisting a password", () => {
  const raw = serializeOnboardingDraft({ step: 3, elective: "biology", intensity: "standard", days: [1, 3],
    profile: { firstName: "Максим", lastName: "", nickname: "student", password: "never-store-this",
      examYear: 2027, targetScore: 160, dailyMinutes: 90, preferredTime: "18:00" } });
  expect(raw).not.toContain("never-store-this");
  expect(raw).not.toContain("password");
  expect(parseOnboardingDraft(raw)).toMatchObject({ step: 3, elective: "biology", days: [1, 3], profile: { targetScore: 160 } });
});

it("rejects damaged drafts without accepting injected steps or subjects", () => {
  expect(parseOnboardingDraft("{broken")).toBeNull();
  const raw = serializeOnboardingDraft({ step: 1, elective: "biology", intensity: "light", days: [1],
    profile: { firstName: "Test", lastName: "", nickname: "test", examYear: 2027,
      targetScore: 150, dailyMinutes: 90, preferredTime: "18:00" } });
  expect(parseOnboardingDraft(raw.replace('"step":1', '"step":8'))).toBeNull();
  expect(parseOnboardingDraft(raw.replace('"biology"', '"invalid"'))).toBeNull();
});
