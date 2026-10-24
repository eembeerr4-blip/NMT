import { lessonAccess, lessonReadiness } from "@/lib/readiness";

export type TopicMetricsRow = {
  id: string;
  parentId: string | null;
  lessonJson: string;
  coverage: string;
  questions: { difficulty: string }[];
  videos: { reviewStatus: string }[];
};

export function summarizeTopicContent(topics: TopicMetricsRow[]) {
  const childParents = new Set(topics.map((topic) => topic.parentId).filter(Boolean));
  const leaves = topics.filter((topic) => !childParents.has(topic.id));
  let studentAvailable = 0;
  let editorialReady = 0;
  let coverageReady = 0;

  for (const topic of leaves) {
    if (topic.coverage === "READY") coverageReady += 1;
    const access = lessonAccess(topic);
    if (access.available) studentAvailable += 1;
    const hasChildren = topics.some((child) => child.parentId === topic.id);
    const readiness = lessonReadiness({
      lessonJson: topic.lessonJson,
      questions: topic.questions,
      videos: topic.videos,
      children: hasChildren ? [{ id: topic.id }] : [],
    });
    if (readiness.ready) editorialReady += 1;
  }

  return {
    totalTopics: topics.length,
    leafTopics: leaves.length,
    studentAvailable,
    editorialReady,
    coverageReady,
  };
}
