import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
vi.mock("@/server/actions",()=>({completeLesson:vi.fn()}));
import {CompleteLesson} from "./lesson-complete";
it("C07 distinguishes reading theory from completing a practice-backed lesson",()=>{
 const theory=renderToStaticMarkup(createElement(CompleteLesson,{topicId:"QA-theory",needsPractice:false}));
 expect(theory).toContain("Позначити конспект як опрацьований");
 const practice=renderToStaticMarkup(createElement(CompleteLesson,{topicId:"QA-practice",needsPractice:true}));
 expect(practice).toContain("Завершити урок");
});
