import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/components/task-controls", () => ({ TaskControls: () => createElement("span", null, "Existing controls") }));
import { LearningRoute, type RouteTask } from "./learning-route";

const task: RouteTask = { id: "task-A", dateKey: "2026-10-19", title: "Власне заняття", detail: "Свій опис", durationMin: 25, status: "PLANNED", topicId: null, subjectId: null, kind: "study", movedFromId: null, subject: null, topic: null };
const html = (tasks: RouteTask[], offset = 0) => renderToStaticMarkup(createElement(LearningRoute, { tasks, offset }));

it("uses actual statuses for markers, including a completed later step and an untouched first step", () => {
  const markup = html([task, { ...task, id: "done", status: "DONE" }, { ...task, id: "active", status: "IN_PROGRESS" }, { ...task, id: "skip", status: "SKIPPED" }]);
  expect(markup).toMatch(/data-stage="future" data-status="PLANNED"/);
  expect(markup).toMatch(/data-stage="done" data-status="DONE"/);
  expect(markup).toMatch(/data-stage="current" data-status="IN_PROGRESS"[^>]+aria-current="step"/);
  expect(markup).toContain("Пропущено");
  expect(markup).not.toContain("Засвоєно");
});

it("links available theory to the topic lesson id, never the StudyTask id", () => {
  const markup = html([{ ...task, topicId: "topic-A", topic: { id: "topic-A", title: "Тема", lessonJson: JSON.stringify({ objectives: [], theory: "Справжня теорія" }), questions: [], videos: [] } }]);
  expect(markup).toContain('/learn/topic-A');
  expect(markup).not.toContain('/learn/task-A');
  expect(markup).toContain("25 хв загалом");
  expect(markup).not.toContain("15 хв");
});

it("does not offer an unavailable lesson, but preserves topic overview and day navigation", () => {
  const markup = html([{ ...task, topicId: "empty", topic: { id: "empty", title: "Без матеріалів", lessonJson: "", questions: [], videos: [{ reviewStatus: "DRAFT" }] } }]);
  expect(markup).not.toContain("/learn/empty");
  expect(markup).toContain("Матеріал готується");
  expect(markup).toContain("/topics/empty");
  expect(markup).toContain("date=2026-10-19");
});

it("keeps custom tasks, long titles, unknown duration and the true numbering across pages", () => {
  const title = "ДовгеУкраїнськеСлово".repeat(25);
  const markup = html([{ ...task, title, durationMin: 0 }], 24);
  expect(markup).toContain(title);
  expect(markup).toContain('start="25"');
  expect(markup).toContain("Тривалість не вказана");
  expect(markup).not.toContain("/learn/");
  expect(markup).toContain("Existing controls");
});

it("keeps moved/cancelled history non-actionable, with a calendar link to its recorded date", () => {
  for (const status of ["MOVED", "DROPPED"]) {
    const markup = html([{ ...task, status }]);
    expect(markup).not.toContain("Existing controls");
    expect(markup).toContain("date=2026-10-19");
  }
  expect(html([{ ...task, movedFromId: "previous-task" }])).toContain("Перенесено на цю дату");
});

it("keeps repeated lessons as distinct tasks and directs a mock to the actual exams route", () => {
  const markup = html([task, { ...task, id: "task-B", kind: "mock" }]);
  expect(markup.match(/data-task-id=/g)).toHaveLength(2);
  expect(markup).toContain('href="/exams"');
});
