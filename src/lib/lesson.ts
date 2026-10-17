export type LessonContent = {
  objectives: string[];
  theory: string;
  rules: string[];
  examples: { task: string; solution: string }[];
  mistakes: string[];
  summary: string;
};

export function parseLesson(raw: string): LessonContent | null {
  if (!raw.trim()) return null;
  try {
    const data = JSON.parse(raw) as LessonContent;
    if (!data || !Array.isArray(data.objectives) || typeof data.theory !== "string") return null;
    return {
      objectives: data.objectives,
      theory: data.theory,
      rules: data.rules ?? [],
      examples: data.examples ?? [],
      mistakes: data.mistakes ?? [],
      summary: data.summary ?? "",
    };
  } catch {
    return null;
  }
}
