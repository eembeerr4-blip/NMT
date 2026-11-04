import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseContentPackage } from "@/lib/content-package";
import { gradeAnswer } from "@/lib/grade";

const read = (file: string) => JSON.parse(readFileSync("content/stage8/" + file, "utf8"));
const paths = ["packages/math-reviewed.package.json", "packages/ukrainian-foundation.package.json", "packages/history-foundation.package.json", "packages/biology-foundation.package.json", "batch02/ukrainian-grammar.package.json"];
const parsed = paths.map(file => parseContentPackage(readFileSync("content/stage8/" + file, "utf8")));
const topics = parsed.flatMap(p => p.package?.sections.flatMap(s => s.topics) ?? []);
const questions = topics.flatMap(t => t.questions);
const ledger = read("independent-review-ledger.json") as { questions: { id: string; blindDerivedAnswer: unknown; status: string; factualOutcome: string }[] };
const bank = read("validation81/math-expressions-assessment-bank.json") as { questions: typeof questions; final: { questionIds: string[] }; delayed: { questionIds: string[] }; trainingQuestionIds: string[] };

it("validates all fifteen candidate modules without treating structural validation as editorial approval", () => {
  for (const p of parsed) expect(p.report.errors).toEqual([]);
  expect(topics).toHaveLength(15);
  expect(questions).toHaveLength(180);
  expect(new Set(ledger.questions.map(q => q.id))).toEqual(new Set(questions.map(q => q.code)));
  expect(ledger.questions.some(q => q.status === "NEEDS_REVISION")).toBe(true);
});

it.each(questions)("grades reviewed key and rejects a wrong answer for $code", q => {
  const answer = ["MATCHING", "SEQUENCE"].includes(q.type) ? JSON.parse(q.correctAnswer) : q.correctAnswer;
  expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: answer }).isCorrect).toBe(true);
  expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: "wrong" }).isCorrect).not.toBe(true);
});

it.each(questions.filter(q => !["s8-ukrainian-foundation-09", "s8-ukrainian-foundation-11"].includes(q.code)))("accepts independently derived blind answer for $code", q => {
  const independent = ledger.questions.find(row => row.id === q.code)!;
  expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: independent.blindDerivedAnswer }).isCorrect).toBe(true);
});

it("validates the twelve new questions through the actual import contract", () => {
  const topic = topics.find(t => t.code === "math-expressions")!;
  const result = parseContentPackage(JSON.stringify({ format: "nmt-content-package", version: 1, subjectId: "math", provenance: { origin: "original", title: "Stage81 reviewed assessment pilot", license: "original" }, sections: [{ code: "s81-pilot", title: "QA only", topics: [{ ...topic, code: "s81-expressions-pilot", questions: bank.questions }] }] }));
  expect(result.report.errors).toEqual([]);
  expect(result.package?.sections[0].topics[0].questions).toHaveLength(12);
});

it("keeps the blind original findings rather than retroactively rewriting their answers", () => {
  for (const id of ["s8-ukrainian-foundation-09", "s8-ukrainian-foundation-11"]) {
    expect(JSON.stringify(ledger.questions.find(q => q.id === id)?.blindDerivedAnswer)).toMatch(/NO_/);
    expect(ledger.questions.find(q => q.id === id)?.factualOutcome).toBe("CORRECTED_AND_RECHECKED");
  }
  const lesson = topics.find(t => t.code === "cm-ukrainian-formation")!;
  expect(lesson.lesson.theory).toContain("хмара → хмарний → безхмарний");
  expect(lesson.lesson.theory).not.toContain("У хмара → безхмарний одночасно");
  const matching = questions.find(q => q.code === "s8-ukrainian-foundation-09")!;
  expect(matching.options.find(o => o.label === "3")?.text).toBe("піч → запічок");
  expect(questions.find(q => q.code === "s8-ukrainian-foundation-11")?.options.find(o => o.label === "В")?.text).toBe("Префіксальним");
  expect(questions.find(q => q.code === "s8b2-2-11")?.explanation).toContain("У варіанті Б");
});

it.each(bank.questions)("checks new reviewed assessment item $code", q => {
  expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: q.correctAnswer }).isCorrect).toBe(true);
  expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: "-99999" }).isCorrect).not.toBe(true);
});

it("keeps training/final/delayed identifiers and prompts disjoint", () => {
  const ids = [...bank.trainingQuestionIds, ...bank.final.questionIds, ...bank.delayed.questionIds];
  expect(new Set(ids).size).toBe(24);
  expect(bank.final.questionIds).toHaveLength(6);
  expect(bank.delayed.questionIds).toHaveLength(6);
  const prompts = [...topics.find(t => t.code === "math-expressions")!.questions, ...bank.questions].map(q => q.prompt);
  expect(new Set(prompts).size).toBe(prompts.length);
});

it("preserves all nineteen mathematical example checks byte for byte", () => {
  const original = read("math-draft-reviewed.v2.json");
  const fromOriginal = original.packs.flatMap((p: { lesson: { examples: { answerCheck?: unknown }[] } }) => p.lesson.examples.filter(e => e.answerCheck).map(e => e.answerCheck));
  const fromPackages = topics.slice(0, 10).flatMap(t => t.lesson.examples.filter(e => e.answerCheck).map(e => e.answerCheck));
  expect(fromOriginal).toHaveLength(19);
  expect(fromPackages).toEqual(fromOriginal);
});

it("accounts honestly for all214 topics and757 unapproved fine-grained mappings", () => {
  const map = read("program-crosswalk-audit.json");
  expect(map.status).toBe("PARTIAL");
  expect(map.topics).toHaveLength(214);
  expect(map.topics.flatMap((t: { subtopics: unknown[] }) => t.subtopics)).toHaveLength(757);
});
