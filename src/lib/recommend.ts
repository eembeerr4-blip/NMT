export type RecommendTopic = {
  id: string;
  subjectId: string;
  title: string;
  status: string;
  mistakeCount: number;
  lastCorrect: number | null;
  lastTotal: number | null;
};

export function recommendTopics(
  topics: RecommendTopic[],
  priorities: Record<string, number>,
  limit = 6,
) {
  return topics
    .filter((topic) => topic.status !== "MASTERED")
    .map((topic) => {
      const priority = priorities[topic.subjectId] ?? 0;
      let score = priority;
      if (topic.status === "NEEDS_REVIEW") score += 30;
      if (topic.status === "IN_PROGRESS") score += 18;
      if (topic.status === "NOT_STARTED") score += 8;
      score += Math.min(40, topic.mistakeCount * 10);
      if (topic.lastTotal && topic.lastCorrect !== null && topic.lastCorrect / topic.lastTotal < 0.6) score += 20;
      const reasons = [
        topic.mistakeCount > 1 ? "Ти часто помиляєшся тут" : topic.mistakeCount === 1 ? "Повтори цю тему" : "",
        topic.status === "NEEDS_REVIEW" ? "Повтори цю тему" : "",
        topic.status === "NOT_STARTED" ? "Повернися до попереднього матеріалу" : "",
        topic.lastTotal && topic.lastCorrect !== null && topic.lastCorrect / topic.lastTotal < 0.6 ? "Спробуй інше пояснення" : "",
        topic.lastTotal && topic.lastCorrect !== null && topic.lastCorrect / topic.lastTotal < 0.5 ? "Пройди додатковий тест" : "",
        `пріоритет предмета ${priority}%`,
      ].filter(Boolean);
      return {
        ...topic,
        score,
        minutes: Math.max(30, Math.round((priority / 100) * 150)),
        reason: [...new Set(reasons)].join("; "),
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "uk"))
    .slice(0, limit);
}
