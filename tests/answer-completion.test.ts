import {describe,expect,it} from "vitest";
import {answerCompletion} from "../src/lib/answer-completion";
describe("answer completion",()=>{
 it("does not accept whitespace but accepts zero",()=>{const q={type:"NUMERIC",options:[]};expect(answerCompletion(q,"  ")).toBe("empty");expect(answerCompletion(q,0)).toBe("complete");});
 it("requires a complete, unique sequence",()=>{const q={type:"SEQUENCE",options:[{id:"a",matchKey:null},{id:"b",matchKey:null}]};expect(answerCompletion(q,undefined)).toBe("empty");expect(answerCompletion(q,["a","a"])).toBe("partial");expect(answerCompletion(q,["b","a"])).toBe("complete");});
 it("distinguishes partial matching and unfinished written work",()=>{const q={type:"MATCHING",options:[{id:"a",matchKey:"left"},{id:"b",matchKey:"left"},{id:"c",matchKey:"right"}]};expect(answerCompletion(q,{})).toBe("empty");expect(answerCompletion(q,{a:"c"})).toBe("partial");expect(answerCompletion(q,{a:"c",b:"c"})).toBe("complete");expect(answerCompletion({type:"STEP_BY_STEP",options:[]},{work:"steps"})).toBe("partial");});
});
