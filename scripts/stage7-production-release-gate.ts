/** Read-only release gate using the application's actual import normalization. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { parseContentPackage, planContentPackage } from "../src/lib/content-package";
import { prepareQuestion } from "../src/lib/question-input";
import { loadReleaseAllowlist, STAGE7_PUBLISH_TOPIC_ORDER } from "./stage7-production-browser-release-lib";

export function checkReleaseContent(repoRoot: string, databasePath: string) {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, "content/stage7a/stage7a-content-manifest.v2.json"), "utf8")) as { packages: { file: string }[] };
  const { questionIds } = loadReleaseAllowlist(path.join(repoRoot, "content/stage7c/stage7c-review-decisions.v2.json"));
  const reviews = JSON.parse(readFileSync(path.join(repoRoot, "content/stage7c/stage7c-review-decisions.v2.json"), "utf8")) as { decisions: { questionId: string; contentHash: string }[] };
  const reviewHashes = new Map(reviews.decisions.map(row => [row.questionId, row.contentHash]));
  const seen = new Set<string>();
  const topics = new Set<string>();
  const db = new DatabaseSync(databasePath, { readOnly: true });
  const conflicts: { id: string; field: string }[] = [];
  db.exec("BEGIN");
  try {
    for (const entry of manifest.packages) {
      const raw = readFileSync(path.join(repoRoot, "content/stage7a", entry.file), "utf8");
      const parsed = parseContentPackage(raw);
      const source = JSON.parse(raw) as { sections: { topics: { questions: { code: string; prompt: string; correctAnswer: string; options: unknown[]; explanation: string }[] }[] }[] };
      for (const section of source.sections) for (const topic of section.topics) for (const q of topic.questions) {
        const hash = createHash("sha256").update(JSON.stringify({ prompt: q.prompt, correctAnswer: q.correctAnswer, options: q.options, explanation: q.explanation })).digest("hex");
        if (reviewHashes.get(q.code) !== hash) throw new Error("Reviewed package content changed: " + q.code);
      }
      if (!parsed.package) throw new Error("Release package validation failed");
      const plan = planContentPackage(parsed.package, { subject: { id: parsed.package.subjectId, name: parsed.package.subjectId }, topics: [], questions: [], videos: [] });
      if (!plan.report.ok) throw new Error("Release package normalization failed");
      for (const section of plan.sections) for (const topic of section.topics) {
        if (!STAGE7_PUBLISH_TOPIC_ORDER.includes(topic.code as typeof STAGE7_PUBLISH_TOPIC_ORDER[number]) || topics.has(topic.code)) throw new Error("Unexpected or duplicate release topic");
        topics.add(topic.code);
        const stored = db.prepare("SELECT lessonJson, coverage FROM Topic WHERE id=?").get(topic.code) as { lessonJson: string; coverage: string } | undefined;
        if (!stored || !["DRAFT", "READY"].includes(stored.coverage) || !isDeepStrictEqual(JSON.parse(stored.lessonJson), JSON.parse(topic.lessonJson))) conflicts.push({ id: topic.code, field: "lessonJson/coverage" });
        if (Number(db.prepare("SELECT COUNT(*) AS c FROM Topic WHERE parentId=?").get(topic.code)?.c)) conflicts.push({ id: topic.code, field: "children" });
        const bank = db.prepare("SELECT id FROM Question WHERE topicId=?").all(topic.code);
        if (bank.length !== 12) conflicts.push({ id: topic.code, field: "questionCount" });
        for (const q of topic.questions) {
          if (!questionIds.has(q.id) || seen.has(q.id)) throw new Error("Unexpected or duplicate release question");
          seen.add(q.id);
          const live = db.prepare("SELECT * FROM Question WHERE id=?").get(q.id);
          const options = db.prepare("SELECT id,label,text,sortOrder,matchKey FROM QuestionOption WHERE questionId=? ORDER BY sortOrder").all(q.id);
          const expectedOptions = q.options.map(o => ({ ...o, id: options.find(liveOption => liveOption.label === o.label)?.id ?? o.id }));
          const labelById = new Map(q.options.map(o => [o.id, o.label]));
          // The import planner stores SINGLE_CHOICE keys as generated option IDs, not package labels.
          // Convert the expected key back to labels, then use the shared validator with live option IDs.
          let answer = q.correctAnswer;
          if (q.type === "SINGLE_CHOICE") answer = labelById.get(answer) ?? answer;
          if (q.type === "SEQUENCE") answer = JSON.stringify((JSON.parse(answer) as string[]).map(id => labelById.get(id) ?? id));
          if (q.type === "MATCHING") answer = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(answer) as Record<string, string>).map(([l, r]) => [labelById.get(l) ?? l, labelById.get(r) ?? r])));
          const expected = prepareQuestion({ ...q, subjectId: plan.subjectId, topicId: topic.code, verificationStatus: "DRAFT", correctAnswer: answer, options: expectedOptions }, { preserveIds: true });
          for (const field of ["subjectId", "topicId", "type", "difficulty", "prompt", "explanation", "correctAnswer", "source"] as const) {
            if (live?.[field] !== expected[field]) conflicts.push({ id: q.id, field });
          }
          const optionShape = (o: Record<string, unknown>) => ({ label: o.label, text: o.text, sortOrder: o.sortOrder, matchKey: o.matchKey ?? null });
          if (!isDeepStrictEqual(options.map(optionShape), expected.options.map(optionShape))) conflicts.push({ id: q.id, field: "options" });
          if (!live || !["DRAFT", "VERIFIED"].includes(String(live.verificationStatus))) conflicts.push({ id: q.id, field: "verificationStatus" });
        }
      }
    }
    if (seen.size !== 120 || topics.size !== 10) throw new Error("Incomplete release package set");
    if (conflicts.length) throw new Error("Release content conflicts: " + JSON.stringify(conflicts));
    return { questions: seen.size, topics: topics.size, ok: true };
  } finally { db.exec("ROLLBACK"); db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2] || !path.isAbsolute(process.argv[2])) throw new Error("Explicit absolute database path required");
    console.log(JSON.stringify(checkReleaseContent(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), process.argv[2])));
  } catch (error) { console.error(error instanceof Error ? error.message : "Content gate failed"); process.exitCode = 1; }
}

export function assertReleaseQuestionsVerified(databasePath: string, ids: Set<string>) {
  if (ids.size !== 120) throw new Error("Publish-only resume requires the complete 120-question allowlist");
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const missing = [...ids].filter(id => db.prepare("SELECT verificationStatus FROM Question WHERE id=?").get(id)?.verificationStatus !== "VERIFIED");
    if (missing.length) throw new Error("Publish-only resume blocked: unverified or missing questions " + missing.join(","));
  } finally { db.close(); }
}
