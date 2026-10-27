import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LessonExample } from "./lesson-example";
import { parseLesson } from "@/lib/lesson";

it("ships solutions hidden, with an always-available independent disclosure", () => {
  const html=renderToStaticMarkup(createElement(LessonExample,{index:0,example:{task:"5x − 7 = 2x + 8",solution:"x = 5",answerCheck:{type:"numeric",value:5,variable:"x"}}}));
  expect(html).toContain('aria-expanded="false"');
  expect(html).toMatch(/hidden=""[^>]*class="d04-example-solution"/);
  expect(html).toContain('Переглянути розв');
  expect(html).toContain('disabled=""');
  expect(html).toContain('type="text"');
  expect(html).not.toContain('type="number"');
});
it("does not offer automatic checking without explicit structured metadata", () => {
  const html=renderToStaticMarkup(createElement(LessonExample,{index:0,example:{task:"Умова",solution:"Відповідь 5"}}));
  expect(html).not.toContain('<input');
  expect(html).not.toContain('Перевірити відповідь');
  expect(html).toContain('aria-expanded="false"');
});
it("does not turn malformed metadata into a guessed key", () => {
  const lesson=parseLesson(JSON.stringify({objectives:[],theory:"Theory",examples:[{task:"Question",solution:"x=5",answerCheck:{type:"numeric",value:"5"}}]}));
  const html=renderToStaticMarkup(createElement(LessonExample,{index:0,example:lesson!.examples[0]}));
  expect(html).not.toContain('<input');
});
