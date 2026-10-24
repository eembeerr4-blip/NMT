import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MathText } from "@/components/math-text";
import { CONTENT_PACKAGE_LIMITS } from "./content-package-limits";
import { inspectContentPackage, type PackageLookup } from "./content-package";

const theory = "Еукаріотична клітина має мембрану, цитоплазму та ядро. Цей текст достатній для чернетки.";
const lookup = (patch: Partial<PackageLookup> = {}): PackageLookup => ({
  subject: { id: "biology", name: "Біологія" }, topics: [], questions: [], videos: [], ...patch,
});
const lesson = { theory, objectives: ["Розрізнити частини клітини"], rules: [], examples: [], mistakes: [], summary: "" };
const question = (code: string, patch: Record<string, unknown> = {}) => ({
  code, type: "SINGLE_CHOICE", difficulty: "EASY", prompt: `Питання ${code} для перевірки пакета`,
  explanation: "Пояснення відповіді.", correctAnswer: "А",
  options: [{ label: "А", text: "У ядрі" }, { label: "Б", text: "У стінці" }], ...patch,
});
const pack = (topics = [topic()], sectionsPatch?: Record<string, unknown>) => JSON.stringify({
  format: "nmt-content-package", version: 1, subjectId: "biology",
  provenance: { origin: "original", title: "NMT Academy", license: "original", note: "" },
  sections: [{ code: "pkg-section", title: "Розділ", summary: "", topics, ...sectionsPatch }],
});
const topic = (code = "pkg-topic", patch: Record<string, unknown> = {}) => ({
  code, title: "Тема", summary: "", lesson, questions: [question(`${code}-q`)], ...patch,
});

it("accepts the repository example and keeps script text unexecuted", () => {
  const raw = readFileSync("docs/content/examples/biology-cell.package.json", "utf8");
  const plan = inspectContentPackage(raw, lookup());
  expect(plan.report.ok, JSON.stringify(plan.report.errors)).toBe(true);
  expect(plan.report.subjectName).toBe("Біологія");
  expect(plan.report.counts).toMatchObject({ sectionsToCreate: 1, topicsToCreate: 1, questionsToCreate: 1, videosToAdd: 1 });
  const hostile = pack([topic("pkg-topic", { lesson: { ...lesson, theory: `${theory} <script>alert(1)</script>` } })]);
  const stored = inspectContentPackage(hostile, lookup());
  expect(stored.report.ok).toBe(true);
  expect(stored.sections[0].topics[0].lessonJson).toContain("<script>alert(1)</script>");
  expect(renderToStaticMarkup(createElement(MathText, { text: `${theory} <script>alert(1)</script>` }))).not.toContain("<script");
});

it("rejects invalid JSON, an empty package and a duplicated code", () => {
  expect(inspectContentPackage("{", lookup()).report.errors[0].message).toMatch(/JSON/);
  expect(inspectContentPackage(pack([], { topics: [] }).replace('"topics":[]', '"topics":[]'), lookup()).report.ok).toBe(false);
  const empty = inspectContentPackage(JSON.stringify({ format: "nmt-content-package", version: 1, subjectId: "biology", provenance: { origin: "original", title: "NMT", license: "original" }, sections: [] }), lookup());
  expect(empty.report.ok).toBe(false);
  const duplicated = inspectContentPackage(pack([topic("same"), topic("same")]), lookup());
  expect(duplicated.report.ok).toBe(false);
  expect(duplicated.report.errors.some((issue) => issue.message.includes("повторено"))).toBe(true);
  expect(duplicated.report.counts.topicsToCreate).toBe(0);
});

it("rejects a missing topic reference, a wrong answer and a non-YouTube link", () => {
  const missing = inspectContentPackage(pack([topic("pkg-topic", { questions: [question("pkg-topic-q", { topicCode: "missing-topic" })] })]), lookup());
  expect(missing.report.ok).toBe(false);
  expect(missing.report.errors.some((issue) => issue.message.includes("тему"))).toBe(true);
  const answer = inspectContentPackage(pack([topic("pkg-topic", { questions: [question("pkg-topic-q", { correctAnswer: "В" })] })]), lookup());
  expect(answer.report.ok).toBe(false);
  expect(answer.report.errors.some((issue) => issue.message.includes("невідомий"))).toBe(true);
  const video = inspectContentPackage(pack([topic("pkg-topic", { video: { url: "https://evil.example/watch?v=abcdefghijk", title: "" } })]), lookup());
  expect(video.report.ok).toBe(false);
  expect(video.report.errors.some((issue) => issue.message.includes("YouTube"))).toBe(true);
  const shorts = inspectContentPackage(pack([topic("pkg-topic", { video: { url: "https://www.youtube.com/shorts/abcdefghijk", title: "Shorts" } })]), lookup());
  expect(shorts.report.ok, JSON.stringify(shorts.report.errors)).toBe(true);
});

it("accepts a package at the limit and rejects anything past it", () => {
  const topics = Array.from({ length: CONTENT_PACKAGE_LIMITS.maxTopics }, (_, index) => topic(`pkg-limit-${index}`, {
    questions: Array.from({ length: 5 }, (_, questionIndex) => question(`pkg-limit-${index}-q${questionIndex}`, { type: "NUMERIC", correctAnswer: "4", options: [], prompt: `Числове питання ${index}-${questionIndex} для великого пакета` })),
  }));
  const full = inspectContentPackage(pack(topics), lookup());
  expect(full.report.ok, JSON.stringify(full.report.errors.slice(0, 3))).toBe(true);
  expect(full.report.counts.questionsToCreate).toBe(CONTENT_PACKAGE_LIMITS.maxQuestions);
  topics.push(topic("pkg-limit-extra"));
  expect(inspectContentPackage(pack(topics), lookup()).report.ok).toBe(false);
  expect(inspectContentPackage("x".repeat(CONTENT_PACKAGE_LIMITS.maxBytes + 1), lookup()).report.errors[0].message).toMatch(/2 МБ/);
});

it("skips a protected lesson and does not plan a write when the subject is missing", () => {
  const raw = pack([topic("math-protected")], { code: "pkg-math-section" });
  const biologyPackage = raw.replace('"subjectId":"biology"', '"subjectId":"math"');
  const skipped = inspectContentPackage(biologyPackage, lookup({
    subject: { id: "math", name: "Математика" },
    topics: [{ id: "math-protected", subjectId: "math", parentId: null, coverage: "VERIFIED", lessonJson: "{\"theory\":\"є\"}" }],
  }));
  expect(skipped.report.ok, JSON.stringify(skipped.report.errors)).toBe(true);
  expect(skipped.report.topics[0].disposition).toBe("skip-protected");
  expect(skipped.report.counts.topicsToCreate).toBe(0);
  expect(inspectContentPackage(raw, lookup({ subject: null })).report.ok).toBe(false);
});
