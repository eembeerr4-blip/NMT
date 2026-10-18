import { expect, it } from "vitest";
import { lessonReadiness } from "./readiness";
import { parseLesson } from "./lesson";
import { fitDailyLoad } from "./fit-daily-load";
const lesson={objectives:["Тема"],theory:"Пояснення ".repeat(100),rules:["Правило"],examples:[{task:"1",solution:"1"},{task:"2",solution:"2"}],mistakes:["Помилка"],summary:"Висновок"};
const questions=[...Array.from({length:4},()=>({difficulty:"EASY"})),...Array.from({length:5},()=>({difficulty:"MEDIUM"})),...Array.from({length:3},()=>({difficulty:"HARD"}))];
it("requires every component of a complete lesson and does not count candidate videos",()=>{
 const topic={lessonJson:JSON.stringify(lesson),questions,videos:[{reviewStatus:"SUGGESTED"}]};
 expect(lessonReadiness(topic).ready).toBe(false);
 expect(lessonReadiness({...topic,videos:[{reviewStatus:"CONFIRMED"}]}).ready).toBe(true);
 expect(lessonReadiness({...topic,children:[{}],videos:[{reviewStatus:"CONFIRMED"}]}).ready).toBe(false);
 expect(lessonReadiness({...topic,questions:questions.map(q=>({...q,difficulty:"EASY"}))}).practice).toBe(false);
});
it("handles malformed lesson arrays without crashing a page",()=>{
 const parsed=parseLesson(JSON.stringify({...lesson,rules:"bad",examples:[null,{}],sources:[null,{url:"javascript:alert(1)",title:"invalid"}]}));
 expect(parsed?.rules).toEqual([]);expect(parsed?.examples).toEqual([]);expect(parsed?.sources).toEqual([]);
});
it("does not generate work when the daily budget is exhausted",()=>{
 expect(fitDailyLoad([{durationMin:30}],0)).toEqual([]);
});
