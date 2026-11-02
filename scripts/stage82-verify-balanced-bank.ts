import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { parseContentPackage } from "../src/lib/content-package";
import { gradeAnswer } from "../src/lib/grade";
import { lessonReadiness } from "../src/lib/readiness";
const file = "content/stage8/validation82/packages/math-reviewed.package.json";
const raw = readFileSync(file, "utf8");
const parsed = parseContentPackage(raw);
assert.deepEqual(parsed.report.errors, []);
const topic = parsed.package!.sections.flatMap(s => s.topics).find(t => t.code === "math-expressions")!;
assert.equal(topic.questions.length, 12);
const positive = Array.from({ length: 201 }, (_, i) => i - 100).filter(x => {
  if ([-4, -2, 3].includes(x)) return false;
  const bracket = Math.abs(x + 4) / (x + 4) - Math.abs(x - 3) / (x - 3);
  return bracket * (x * x + x - 12) / (x * x - x - 6) > 0;
});
assert.deepEqual(positive, [-1, 0, 1, 2]);
const logDomain = Array.from({ length: 101 }, (_, i) => i - 50).filter(x => x > 1 && x !== 2 && x !== -2 && (x * x - 5 * x + 6) / (x * x - 4) > 0 && 7 - x >= 0);
assert.deepEqual(logDomain, [4, 5, 6, 7]);
const derived: (string | number | Record<string, string>)[] = [3 * 4 - 2 * 4 + 5, (-2 * 2) ** 3, Math.sqrt((-1 - 2) ** 2) + Math.log2(8), Math.log(27) / Math.log(3), (((-2) ** 2 - 9) / (-2 - 3) - ((-2) ** 2 - 4) / (-2 - 2)) * -2, Math.sqrt((-5) ** 2), positive.reduce((a, b) => a + b, 0), logDomain.reduce((a, b) => a + b, 0), { "1": "А", "2": "Б", "3": "В" }, (3 / (3 - 1) - 1 / (3 + 1)) / ((3 ** 2 + 1) / (3 ** 2 - 1)), (3 ** 5 * 9 ** -1) / Math.sqrt(81) + Math.log(1 / 16) / Math.log(4), (2 ** -2 + 2 ** -3) / (2 ** -1 - 2 ** -2)];
for (const [i, q] of topic.questions.entries()) {
  let answer = derived[i];
  if (q.type === "SINGLE_CHOICE") {
    const option = q.options.find(o => Math.abs(Number(o.text) - Number(answer)) < 1e-9);
    assert.ok(option); answer = option.label;
  }
  assert.equal(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: answer }).isCorrect, true, q.code);
  assert.ok(q.explanation.trim());
}
const readiness = lessonReadiness({ lessonJson: JSON.stringify(topic.lesson), questions: topic.questions.map(q => ({ ...q, verificationStatus: "VERIFIED" })), children: [], videos: [] });
assert.deepEqual(readiness.counts, { EASY: 4, MEDIUM: 5, HARD: 3 }); assert.equal(readiness.ready, true);
const baseline = JSON.parse(execFileSync("git", ["show", "4c2a5c0742fca2d6eaff292b5571107e8c8cae43:" + file], { encoding: "utf8" }));
const unchanged = (p: typeof baseline) => p.sections.flatMap((s: { topics: { code: string }[] }) => s.topics).filter((t: { code: string }) => t.code !== "math-expressions");
assert.deepEqual(unchanged(JSON.parse(raw)), unchanged(baseline));
console.log(JSON.stringify({ questions: 12, keys: "12/12 PASS", counts: readiness.counts, publicationGate: "PASS", otherMathTopicsUnchanged: true, numericDomainCrossChecks: "PASS; symbolic proofs in blind review" }));
