import { ELECTIVE_SUBJECT_IDS } from "@/lib/constants";

export type OnboardingDraft = {
  version: 1;
  step: number;
  elective: string;
  intensity: "light" | "standard" | "intense";
  days: number[];
  profile: {
    firstName: string;
    lastName: string;
    nickname: string;
    examYear: number;
    targetScore: number;
    dailyMinutes: number;
    preferredTime: string;
  };
};

export function serializeOnboardingDraft(draft: Omit<OnboardingDraft, "version"> & { profile: OnboardingDraft["profile"] & { password?: string } }) {
  const { firstName, lastName, nickname, examYear, targetScore, dailyMinutes, preferredTime } = draft.profile;
  return JSON.stringify({ version: 1, step: draft.step, elective: draft.elective, intensity: draft.intensity,
    days: draft.days, profile: { firstName, lastName, nickname, examYear, targetScore, dailyMinutes, preferredTime } });
}

export function parseOnboardingDraft(raw: string): OnboardingDraft | null {
  try {
    const draft: unknown = JSON.parse(raw);
    if (!draft || typeof draft !== "object") return null;
    const value = draft as Partial<OnboardingDraft>;
    const profile = value.profile;
    if (value.version !== 1 || !Number.isInteger(value.step) || value.step! < 0 || value.step! > 4 ||
      !ELECTIVE_SUBJECT_IDS.includes(value.elective as never) ||
      !["light", "standard", "intense"].includes(value.intensity ?? "") ||
      !Array.isArray(value.days) || value.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      !profile || typeof profile !== "object" ||
      [profile.firstName, profile.lastName, profile.nickname, profile.preferredTime].some((item) => typeof item !== "string" || item.length > 200) ||
      [profile.examYear, profile.targetScore, profile.dailyMinutes].some((item) => typeof item !== "number" || !Number.isFinite(item))) return null;
    return { version: 1, step: value.step!, elective: value.elective!, intensity: value.intensity!, days: value.days,
      profile: { firstName: profile.firstName!, lastName: profile.lastName!, nickname: profile.nickname!,
        examYear: profile.examYear!, targetScore: profile.targetScore!, dailyMinutes: profile.dailyMinutes!, preferredTime: profile.preferredTime! } };
  } catch { return null; }
}
