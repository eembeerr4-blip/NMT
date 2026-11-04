import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkExampleAnswer, readExampleAnswerCheck } from "./example-answer";
import { parseLesson } from "./lesson";
import { parseContentPackage } from "./content-package";

describe("local example answers", () => {
  it.each(["5", "x=5", "x = 5", " X = 5 ", "5,0"])("accepts an explicit numeric key: %s", answer => {
    expect(checkExampleAnswer(answer, {type:"numeric",value:5,variable:"x"})).toBe(true);
  });
  it.each(["", "4", "x=4", "y=5", "2+3", "5abc", "5 0", "Infinity"])("rejects an incorrect or ambiguous numeric answer: %s", answer => {
    expect(checkExampleAnswer(answer, {type:"numeric",value:5,variable:"x"})).toBe(false);
  });
  it("checks the second supplied equation", () => expect(checkExampleAnswer("x = 4", {type:"numeric",value:4,variable:"x"})).toBe(true));
  it.each(["розв’язків немає", "Розв'язків немає", "немає розв'язків", "∅"])("checks an explicit no-solution key: %s", answer => {
    expect(checkExampleAnswer(answer, {type:"no-solution"})).toBe(true);
  });
  it.each(["0", "x=1", "усі числа"])("rejects a wrong no-solution answer: %s", answer => expect(checkExampleAnswer(answer,{type:"no-solution"})).toBe(false));
  it.each([undefined, null, {}, {type:"numeric",value:"5"}, {type:"numeric",value:Infinity}, {type:"numeric",value:5,variable:"x.*"}])("fails closed for malformed metadata: %j", value => expect(readExampleAnswerCheck(value)).toBeUndefined());
  it("never infers a key from a solution and retains valid explicit metadata", () => {
    const lesson=parseLesson(JSON.stringify({objectives:[],theory:"Theory",examples:[{task:"a",solution:"x=5"},{task:"b",solution:"x=5",answerCheck:{type:"numeric",value:5,variable:"x"}},{task:"c",solution:"x=5",answerCheck:{type:"unknown"}}]}));
    expect(lesson?.examples[0].answerCheck).toBeUndefined();
    expect(lesson?.examples[1].answerCheck).toEqual({type:"numeric",value:5,variable:"x"});
    expect(lesson?.examples[2].answerCheck).toBeUndefined();
  });
  it("preserves optional answerCheck through the package validator", () => {
    const pkg=JSON.parse(readFileSync("docs/content/examples/biology-cell.package.json","utf8"));
    const topic=pkg.sections[0].topics[0];
    topic.lesson.examples[0].answerCheck={type:"numeric",value:5,variable:"x"};
    const parsed=parseContentPackage(JSON.stringify(pkg));
    expect(parsed.package?.sections[0].topics[0].lesson?.examples[0].answerCheck).toEqual({type:"numeric",value:5,variable:"x"});
  });
});
