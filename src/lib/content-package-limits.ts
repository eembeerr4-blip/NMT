export const CONTENT_PACKAGE_LIMITS = {
  format: "nmt-content-package",
  version: 1,
  maxBytes: 2_000_000,
  maxSections: 20,
  maxTopics: 40,
  maxQuestions: 200,
  maxQuestionsPerTopic: 30,
} as const;
