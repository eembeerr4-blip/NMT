export type LessonContent = {
  prerequisites?: string[];
  sources?: { title: string; url: string }[];
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
      prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites.filter((v) => typeof v === "string") : [],
      sources: Array.isArray(data.sources) ? data.sources.filter((v) => typeof v?.title === "string" && typeof v?.url === "string" && /^https:\/\//.test(v.url)) : [],
      objectives: data.objectives.filter((v) => typeof v === "string"),
      theory: data.theory,
      rules: Array.isArray(data.rules) ? data.rules.filter(v=>typeof v === "string") : [],
      examples: Array.isArray(data.examples) ? data.examples.filter(v=>typeof v?.task === "string" && typeof v?.solution === "string") : [],
      mistakes: Array.isArray(data.mistakes) ? data.mistakes.filter(v=>typeof v === "string") : [],
      summary: typeof data.summary === "string" ? data.summary : "",
    };
  } catch {
    return null;
  }
}
