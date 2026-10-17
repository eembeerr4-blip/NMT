import { describe, expect, it } from "vitest";
import { getOnboardingSubjects, getSubjectResource, SUBJECT_RESOURCES } from "./subjects";

describe("external subject-test resources", () => {
  it("uses only configured HTTPS links on the known Osвіта.ua host", () => {
    for (const resource of Object.values(SUBJECT_RESOURCES)) {
      const url = new URL(resource.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("zno.osvita.ua");
    }
  });

  it("marks language catalog links accurately instead of claiming they are NMT test pages", () => {
    expect(SUBJECT_RESOURCES.chemistry.kind).toBe("catalog");
    expect(SUBJECT_RESOURCES.german.kind).toBe("catalog");
    expect(SUBJECT_RESOURCES.french.kind).toBe("catalog");
    expect(SUBJECT_RESOURCES.spanish.kind).toBe("catalog");
    expect(SUBJECT_RESOURCES.english.kind).toBe("nmt-tests");
  });

  it("does not construct a URL for unsupported subject ids", () => {
    expect(getSubjectResource("unknown")).toBeNull();
    expect(getOnboardingSubjects().every((subject) => getSubjectResource(subject.id) !== null)).toBe(true);
  });
});
