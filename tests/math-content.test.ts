import {describe,expect,it} from "vitest";
import {loadMathContent,mathContentSchema} from "../src/lib/math-content";
import {verifyMathContent,verifyMathQuestion,evaluateMath} from "../scripts/verify-math-content";
import {prepareQuestion} from "../src/lib/question-input";
import {lessonReadiness} from "../src/lib/readiness";
const content=loadMathContent();
describe("authored mathematics drafts",()=>{
 it("validates every answer, example and formula without publishing drafts",()=>{expect(verifyMathContent(content)).toMatchObject({topics:10,questions:120,calculations:160,status:"DRAFT",result:"PASS"});});
 for(const pack of content.packs)it(pack.topicId+" has a complete 4/5/3 authoring kit",()=>{
  expect(pack.questions.map(q=>q.difficulty).filter(d=>d==="EASY")).toHaveLength(4);
  expect(pack.questions.filter(q=>q.difficulty==="MEDIUM")).toHaveLength(5);
  expect(pack.questions.filter(q=>q.difficulty==="HARD")).toHaveLength(3);
  for(const q of pack.questions){expect(q.explanation.trim().length).toBeGreaterThan(30);expect(q.verificationStatus).toBe("DRAFT");expect(prepareQuestion(q).correctAnswer).toBeTruthy();}
  const base = { lessonJson: JSON.stringify(pack.lesson), videos: [], children: [] };
  expect(lessonReadiness({ ...base, questions: pack.questions })).toMatchObject({
    theory: true,
    examples: true,
    practice: false,
    ready: false,
  });
  expect(
    lessonReadiness({
      ...base,
      questions: pack.questions.map((q) => ({ ...q, verificationStatus: "VERIFIED" as string })),
    }),
  ).toMatchObject({ practice: true, ready: true });
 });
 it("rejects a wrong answer independently of the authored key",()=>{const q=structuredClone(content.packs[0].questions.find(q=>q.type==="NUMERIC")!);q.correctAnswer="999999";expect(()=>verifyMathQuestion(q)).toThrow(/calculated/);});
 it("rejects ambiguous distractors",()=>{const q=structuredClone(content.packs[0].questions[0]);q.options[1].numericValue=q.options[0].numericValue;expect(()=>verifyMathQuestion(q)).toThrow();});
 it("rejects invalid matching references",()=>{const q=structuredClone(content.packs[0].questions.find(q=>q.type==="MATCHING")!);q.correctAnswer=JSON.stringify({1:"missing",2:"missing",3:"missing"});expect(()=>verifyMathQuestion(q)).toThrow();});
 it("rejects malformed KaTeX",()=>{const bad=structuredClone(content);bad.packs[0].lesson.theory+=" $\\badcommand{1}$";expect(()=>verifyMathContent(bad)).toThrow();});
 it("requires stable ids and DRAFT status",()=>{const bad=structuredClone(content) as unknown as {packs:{questions:{id?:string;verificationStatus:string}[]}[]};delete bad.packs[0].questions[0].id;expect(mathContentSchema.safeParse(bad).success).toBe(false);});
 it("handles degree-based trig and rejects non-finite results",()=>{expect(evaluateMath("sin(30)")).toBeCloseTo(.5);expect(()=>evaluateMath("1/0")).toThrow();});
});
