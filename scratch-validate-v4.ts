/**
 * Validate fixed-v4 using the real contentPackageSchema + inspectContentPackage
 */
import { readFileSync } from "fs";
import { parseContentPackage, inspectContentPackage } from "./src/lib/content-package";
import type { PackageLookup } from "./src/lib/content-package";

const FILE = String.raw`D:\матерелы ТГК\_NMT_ПАКЕТИ\math\math-basics-01.package.fixed-v4.json`;

const raw = readFileSync(FILE, "utf-8");
console.log(`Read ${raw.length} chars from ${FILE}\n`);

// Step 1: parseContentPackage (Zod validation only, no DB lookup)
console.log("=== STEP 1: parseContentPackage (Zod safeParse) ===");
const { package: pkg, report: parseReport } = parseContentPackage(raw);

if (!pkg) {
  console.log("ZOD FAIL");
  console.log("Errors:", JSON.stringify(parseReport.errors, null, 2));
  process.exit(1);
}

console.log("ZOD PASS");
console.log(`subjectId: ${parseReport.subjectId}`);
console.log(`subjectName: ${parseReport.subjectName}`);

// Count what Zod parsed
let topicCount = 0;
let questionCount = 0;
let exampleCount = 0;
const questionCodes: string[] = [];
const questionTypes: Record<string, number> = {};

for (const section of pkg.sections) {
  for (const topic of section.topics) {
    topicCount++;
    exampleCount += topic.lesson.examples.length;
    for (const q of topic.questions) {
      questionCount++;
      questionCodes.push(q.code);
      questionTypes[q.type] = (questionTypes[q.type] || 0) + 1;
    }
  }
}

console.log(`\nParsed topics: ${topicCount}`);
console.log(`Parsed examples: ${exampleCount}`);
console.log(`Parsed questions: ${questionCount}`);
console.log(`Question types: ${JSON.stringify(questionTypes)}`);
console.log(`Question codes: ${JSON.stringify(questionCodes)}`);

if (questionCount !== 30) {
  console.log(`\nFAIL: Expected 30 questions, Zod parsed ${questionCount}`);
  process.exit(1);
}

// Step 2: inspectContentPackage (full plan including prepareQuestion)
console.log("\n=== STEP 2: inspectContentPackage (plan with prepareQuestion) ===");

// Create an empty lookup (fresh DB scenario — no existing topics or questions)
const emptyLookup: PackageLookup = {
  subject: { id: "math", name: "Математика" },
  topics: [],
  questions: [],
  videos: [],
};

const plan = inspectContentPackage(raw, emptyLookup);
const { report } = plan;

console.log(`Plan ok: ${report.ok}`);
console.log(`Errors: ${report.errors.length}`);
if (report.errors.length > 0) {
  console.log(JSON.stringify(report.errors, null, 2));
}
console.log(`Warnings: ${report.warnings.length}`);
if (report.warnings.length > 0) {
  console.log(JSON.stringify(report.warnings, null, 2));
}
console.log(`Report questionCount: ${report.questionCount}`);
console.log(`Report topics:`, JSON.stringify(report.topics.map(t => ({ code: t.code, questions: t.questions, disposition: t.disposition })), null, 2));
console.log(`Report counts:`, JSON.stringify(report.counts, null, 2));

// Count planned questions
let plannedTotal = 0;
let plannedCreate = 0;
for (const section of plan.sections) {
  for (const topic of section.topics) {
    plannedTotal += topic.questions.length;
    plannedCreate += topic.questions.filter(q => q.action === "create").length;
  }
}

console.log(`\nPlanned questions total: ${plannedTotal}`);
console.log(`Planned questions to create: ${plannedCreate}`);

if (plannedTotal !== 30) {
  console.log(`FAIL: inspectContentPackage recognized ${plannedTotal}/30 questions`);
  process.exit(1);
}

if (!report.ok) {
  console.log("FAIL: report.ok is false, blocking errors present");
  process.exit(1);
}

console.log("\n=== VERDICT: ZOD PASS, 30/30 questions recognized, plan OK ===");
