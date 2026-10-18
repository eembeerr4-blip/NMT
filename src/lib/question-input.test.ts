import { expect, it } from "vitest";
import { prepareQuestion } from "./question-input";
import { gradeAnswer } from "./grade";
import { canEditContent, isAdministrator } from "./permissions";
const base = { subjectId: "math", topicId: "math-linear-eq", difficulty: "EASY", prompt: "Знайдіть правильну відповідь", explanation: "Авторське пояснення", source: "Тест", verificationStatus: "DRAFT" };

it("does not give learners editorial access", () => {
  expect(canEditContent({id:"learner",role:"STUDENT"})).toBe(false);
  expect(canEditContent({id:"editor",role:"EDITOR"})).toBe(true);
  expect(isAdministrator({id:"editor",role:"EDITOR"})).toBe(false);
  expect(isAdministrator({id:"owner"})).toBe(true);
});

it("translates choice labels to the ids actually saved", () => {
  const q=prepareQuestion({...base,type:"SINGLE_CHOICE",correctAnswer:"Б",options:[{label:"А",text:"2"},{label:"Б",text:"4"}]});
  expect(q.correctAnswer).toBe(q.options[1].id);
  expect(gradeAnswer({...q,userAnswer:q.options[1].id}).isCorrect).toBe(true);
});

it("remaps exported option ids when importing a question", () => {
  const q=prepareQuestion({...base,type:"SINGLE_CHOICE",correctAnswer:"old-b",options:[{id:"old-a",label:"А",text:"2"},{id:"old-b",label:"Б",text:"4"}]});
  expect(q.correctAnswer).toBe(q.options[1].id);
  expect(q.correctAnswer).not.toBe("old-b");
});

it("rejects a dangling correct option", () => {
  expect(()=>prepareQuestion({...base,type:"SINGLE_CHOICE",correctAnswer:"В",options:[{label:"А",text:"2"},{label:"Б",text:"4"}]})).toThrow("невідомий");
});

it("rejects duplicate labels and a sequence with missing items", () => {
  expect(()=>prepareQuestion({...base,type:"SEQUENCE",correctAnswer:'["А","А"]',options:[{label:"А",text:"1"},{label:"А",text:"2"}]})).toThrow();
  expect(()=>prepareQuestion({...base,type:"SEQUENCE",correctAnswer:'["А"]',options:[{label:"А",text:"1"},{label:"Б",text:"2"}]})).toThrow();
});

it("accepts and grades a complete sequence", () => {
  const q=prepareQuestion({...base,type:"SEQUENCE",correctAnswer:'["Б","А"]',options:[{label:"А",text:"2"},{label:"Б",text:"1"}]});
  expect(gradeAnswer({...q,userAnswer:JSON.parse(q.correctAnswer)}).isCorrect).toBe(true);
});

it("validates left and right matching pairs", () => {
  const q=prepareQuestion({...base,type:"MATCHING",correctAnswer:'{"1":"А"}',options:[{label:"1",text:"2+2",matchKey:"left"},{label:"А",text:"4",matchKey:"right"}]});
  expect(gradeAnswer({...q,userAnswer:JSON.parse(q.correctAnswer)}).isCorrect).toBe(true);
  expect(()=>prepareQuestion({...base,type:"MATCHING",correctAnswer:'{"А":"1"}',options:[{label:"1",text:"2+2",matchKey:"left"},{label:"А",text:"4",matchKey:"right"}]})).toThrow();
});

it("validates numeric answers and retains text and worked answers", () => {
  expect(()=>prepareQuestion({...base,type:"NUMERIC",correctAnswer:"one"})).toThrow();
  for(const type of ["NUMERIC","SHORT_TEXT","STEP_BY_STEP"]){
    const q=prepareQuestion({...base,type,correctAnswer:"4"});
    expect(gradeAnswer({...q,userAnswer:type==="STEP_BY_STEP"?{final:"4",work:"2x=8"}:"4"}).isCorrect).toBe(true);
  }
});

it("accepts exported null match keys on ordinary choices",()=>{
 const q=prepareQuestion({...base,type:"SINGLE_CHOICE",correctAnswer:"old-b",options:[{id:"old-a",label:"А",text:"2",matchKey:null},{id:"old-b",label:"Б",text:"4",matchKey:null}]});expect(q.correctAnswer).toBe(q.options[1].id);
});
