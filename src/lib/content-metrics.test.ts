import { describe, expect, it } from "vitest";
import { summarizeTopicContent } from "./content-metrics";

describe("summarizeTopicContent", () => {
  it("counts leaf topics and student availability separately from READY coverage", () => {
    const stats = summarizeTopicContent([
      {
        id: "parent",
        parentId: null,
        lessonJson: "",
        coverage: "PARTIAL",
        questions: [],
        videos: [],
      },
      {
        id: "leaf-ready",
        parentId: "parent",
        lessonJson: JSON.stringify({ theory: "x" }),
        coverage: "READY",
        questions: [{ difficulty: "EASY" }],
        videos: [],
      },
      {
        id: "leaf-partial",
        parentId: "parent",
        lessonJson: "",
        coverage: "PARTIAL",
        questions: [],
        videos: [],
      },
    ]);
    expect(stats.totalTopics).toBe(3);
    expect(stats.leafTopics).toBe(2);
    expect(stats.coverageReady).toBe(1);
    expect(stats.studentAvailable).toBe(1);
  });
});
