import { expect, it } from "vitest";
import { ukrainianLearnerRoute } from "./ukrainian-route";

const topic = (id: string, parentId: string | null = null) => ({ id, parentId, sortOrder: 0, coverage: "READY", lessonJson: JSON.stringify({objectives:[],theory:"Available"}), questions: [], videos: [] });

it("crosses sections, puts word structure before phonetics and morphology before syntax, omits drafts and empty parents", () => {
  const rows = [topic("ukr-syntax"), topic("ukr-phonetics"), topic("ukr-word"), topic("ukr-morph"), topic("ukr-lex-01-meaning", "section"), {...topic("section"),lessonJson:""}, {...topic("draft"),coverage:"DRAFT"}];
  expect(ukrainianLearnerRoute(rows).map(t => t.id)).toEqual(["ukr-lex-01-meaning", "ukr-morph", "ukr-word", "ukr-phonetics", "ukr-syntax"]);
  expect(rows[0].id).toBe("ukr-syntax");
});
it("never invents missing prerequisites or includes REVIEW-ONLY despite READY coverage", () => {
  const review = {...topic("candidate"),lessonJson:JSON.stringify({objectives:[],theory:"Review",provenance:{origin:"original",title:"Review",license:"original",note:"REVIEW-ONLY"}})};
  expect(ukrainianLearnerRoute([topic("ukr-syntax"), review]).map(t=>t.id)).toEqual(["ukr-syntax"]);
});
