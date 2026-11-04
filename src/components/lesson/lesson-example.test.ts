import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
vi.mock("@/server/lesson-examples",()=>({checkLessonExample:vi.fn(),revealLessonExample:vi.fn()}));
import {LessonExample} from "./lesson-example";
import {LessonExamples} from "./lesson-content";
import {parseLesson} from "@/lib/lesson";

it("does not ship solutions or numeric keys before an explicit request",()=>{
 const lesson={objectives:[],theory:"Theory",examples:[{task:"5x − 7 = 2x + 8",solution:"PRIVATE SOLUTION x=5",answerCheck:{type:"numeric" as const,value:5,variable:"x"}}],rules:[],mistakes:[],summary:""};
 const html=renderToStaticMarkup(createElement(LessonExamples,{topicId:"topic",lesson}));
 expect(html).toContain('aria-expanded="false"');expect(html).toContain('hidden=""');
 expect(html).toContain('type="text"');expect(html).toContain('Перевірити відповідь');
 expect(html).not.toContain('PRIVATE SOLUTION');expect(html).not.toContain('answerCheck');
});
it("does not offer automatic checking without explicit supported metadata",()=>{
 const html=renderToStaticMarkup(createElement(LessonExample,{topicId:"topic",index:0,task:"Question",canCheck:false}));
 expect(html).not.toContain('<input');expect(html).not.toContain('Перевірити відповідь');expect(html).toContain('aria-expanded="false"');
});
it("does not turn malformed metadata into a guessed key",()=>{
 const lesson=parseLesson(JSON.stringify({objectives:[],theory:"Theory",examples:[{task:"Question",solution:"x=5",answerCheck:{type:"numeric",value:"5"}}]}));
 const html=renderToStaticMarkup(createElement(LessonExamples,{topicId:"topic",lesson}));expect(html).not.toContain('<input');
});
