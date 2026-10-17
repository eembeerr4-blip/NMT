import { ELECTIVE_SUBJECT_IDS, REQUIRED_SUBJECT_IDS, SUBJECTS } from "@/lib/constants";

export const SUBJECT_RESOURCES = {
  ukrainian: { url: "https://zno.osvita.ua/ukrmova/nmt.html", kind: "nmt-tests" },
  math: { url: "https://zno.osvita.ua/mathematics/nmt.html", kind: "nmt-tests" },
  history: { url: "https://zno.osvita.ua/ukraine-history/nmt.html", kind: "nmt-tests" },
  "ukrainian-literature": { url: "https://zno.osvita.ua/ukrlit/nmt.html", kind: "nmt-tests" },
  geography: { url: "https://zno.osvita.ua/geography/nmt.html", kind: "nmt-tests" },
  biology: { url: "https://zno.osvita.ua/biology/nmt.html", kind: "nmt-tests" },
  physics: { url: "https://zno.osvita.ua/physics/nmt.html", kind: "nmt-tests" },
  chemistry: { url: "https://zno.osvita.ua/chemistry/", kind: "catalog" },
  english: { url: "https://zno.osvita.ua/english/nmt.html", kind: "nmt-tests" },
  german: { url: "https://zno.osvita.ua/german/", kind: "catalog" },
  french: { url: "https://zno.osvita.ua/french/", kind: "catalog" },
  spanish: { url: "https://zno.osvita.ua/spanish/", kind: "catalog" },
} as const;

export type ActiveSubjectId = keyof typeof SUBJECT_RESOURCES;

export function getSubjectResource(subjectId: string) {
  return subjectId in SUBJECT_RESOURCES
    ? SUBJECT_RESOURCES[subjectId as ActiveSubjectId]
    : null;
}

export function getOnboardingSubjects() {
  return SUBJECTS.filter((subject) => {
    const isRequired = (REQUIRED_SUBJECT_IDS as readonly string[]).includes(subject.id);
    const isSupportedElective = (ELECTIVE_SUBJECT_IDS as readonly string[]).includes(subject.id);
    return Boolean(getSubjectResource(subject.id)) && (isRequired || isSupportedElective);
  });
}
