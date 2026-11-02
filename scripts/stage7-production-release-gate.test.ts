import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, cpSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseContentPackage, planContentPackage } from "../src/lib/content-package";
import { checkReleaseContent, assertReleaseQuestionsVerified } from "./stage7-production-release-gate";

let dir: string;
let file: string;
let db: DatabaseSync;
let questionId: string;
let topicId: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "nmt-release-gate-test-"));
  file = path.join(dir, "qa.db");
  db = new DatabaseSync(file);
  db.exec("CREATE TABLE Topic(id TEXT PRIMARY KEY, lessonJson TEXT, coverage TEXT, parentId TEXT); CREATE TABLE Question(id TEXT PRIMARY KEY,subjectId TEXT,topicId TEXT,type TEXT,difficulty TEXT,prompt TEXT,explanation TEXT,correctAnswer TEXT,source TEXT,verificationStatus TEXT); CREATE TABLE QuestionOption(id TEXT PRIMARY KEY,questionId TEXT,label TEXT,text TEXT,sortOrder INTEGER,matchKey TEXT)");
  db.exec("BEGIN");
  const manifest = JSON.parse(readFileSync("content/stage7a/stage7a-content-manifest.v2.json", "utf8"));
  for (const entry of manifest.packages) {
    const parsed = parseContentPackage(readFileSync(path.join("content/stage7a", entry.file), "utf8"));
    if (!parsed.package) throw new Error("Bad fixture package");
    const plan = planContentPackage(parsed.package, { subject: { id: parsed.package.subjectId, name: "QA" }, topics: [], questions: [], videos: [] });
    for (const section of plan.sections) for (const t of section.topics) {
      db.prepare("INSERT INTO Topic VALUES (?,?,?,NULL)").run(t.code, t.lessonJson, "DRAFT");
      topicId = t.code;
      for (const q of t.questions) {
        questionId = q.id;
        db.prepare("INSERT INTO Question VALUES (?,?,?,?,?,?,?,?,?,?)").run(q.id,plan.subjectId,t.code,q.type,q.difficulty,q.prompt,q.explanation,q.correctAnswer,q.source,"DRAFT");
        for (const o of q.options) db.prepare("INSERT INTO QuestionOption VALUES (?,?,?,?,?,?)").run(o.id,q.id,o.label,o.text,o.sortOrder,o.matchKey ?? null);
      }
    }
  }
  db.exec("COMMIT");
});
afterEach(() => { db.close(); rmSync(dir, { recursive: true }); });
const gate = () => checkReleaseContent(process.cwd(), file);
describe("normalized read-only Stage 7 release gate", () => {
  it("accepts exactly 120 normalized keys and 10 lessons without writing", () => {
    expect(gate()).toEqual({ ok: true, questions: 120, topics: 10 });
    expect(db.prepare("SELECT COUNT(*) AS c FROM Question WHERE verificationStatus='DRAFT'").get()?.c).toBe(120);
  });
  it("blocks publish-only resume while any allowlisted question is DRAFT", () => {
    const ids = new Set(db.prepare("SELECT id FROM Question").all().map(row => String(row.id)));
    expect(() => assertReleaseQuestionsVerified(file, ids)).toThrow(/unverified/);
    db.exec("UPDATE Question SET verificationStatus='VERIFIED'");
    expect(() => assertReleaseQuestionsVerified(file, ids)).not.toThrow();
    db.prepare("DELETE FROM Question WHERE id=?").run(questionId);
    expect(() => assertReleaseQuestionsVerified(file, ids)).toThrow(/missing/);
  });
  it("accepts idempotent VERIFIED/READY state", () => { db.exec("UPDATE Question SET verificationStatus='VERIFIED'; UPDATE Topic SET coverage='READY'"); expect(gate().ok).toBe(true); });
  it.each(["prompt", "explanation", "correctAnswer"])("rejects changed %s", field => { db.prepare(`UPDATE Question SET ${field}=? WHERE id=?`).run("changed", questionId); expect(gate).toThrow(/conflicts/); });
  it("rejects a package whose content hash no longer has review approval", () => {
    const root = path.join(dir, "package-copy");
    mkdirSync(path.join(root, "content/stage7c"), { recursive: true });
    cpSync("content/stage7a", path.join(root, "content/stage7a"), { recursive: true });
    const reviews = JSON.parse(readFileSync("content/stage7c/stage7c-review-decisions.v2.json", "utf8"));
    reviews.decisions[0].contentHash = "changed";
    writeFileSync(path.join(root, "content/stage7c/stage7c-review-decisions.v2.json"), JSON.stringify(reviews));
    expect(() => checkReleaseContent(root, file)).toThrow(/Reviewed package content changed/);
  });
  it("rejects changed option text", () => { db.prepare("UPDATE QuestionOption SET text='changed' WHERE questionId=?").run(questionId); expect(gate).toThrow(/conflicts/); });
  it("rejects changed lesson", () => { db.prepare("UPDATE Topic SET lessonJson='{}' WHERE id=?").run(topicId); expect(gate).toThrow(/conflicts/); });
  it("rejects topic with children", () => { db.prepare("INSERT INTO Topic VALUES ('qa-child','{}','DRAFT',?)").run(topicId); expect(gate).toThrow(/children/); });
});
