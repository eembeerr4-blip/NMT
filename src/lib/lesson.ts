import { readExampleAnswerCheck, type ExampleAnswerCheck } from "./example-answer";

export type LessonProvenance = {
  origin: "original" | "permitted";
  title: string;
  license: string;
  note: string;
};

export type LessonContent = {
  prerequisites?: string[];
  sources?: { title: string; url: string }[];
  objectives: string[];
  theory: string;
  rules: string[];
  examples: { task: string; solution: string; answerCheck?: ExampleAnswerCheck }[];
  mistakes: string[];
  summary: string;
  notes?: string;
  provenance?: LessonProvenance;
};

function readProvenance(value: unknown): LessonProvenance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if ((item.origin !== "original" && item.origin !== "permitted") || typeof item.title !== "string" || typeof item.license !== "string") return undefined;
  return {
    origin: item.origin,
    title: item.title.slice(0, 200),
    license: item.license.slice(0, 120),
    note: typeof item.note === "string" ? item.note.slice(0, 500) : "",
  };
}

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
      examples: Array.isArray(data.examples) ? data.examples.filter(v=>typeof v?.task === "string" && typeof v?.solution === "string").map(v => ({ ...v, answerCheck: readExampleAnswerCheck(v.answerCheck) })) : [],
      mistakes: Array.isArray(data.mistakes) ? data.mistakes.filter(v=>typeof v === "string") : [],
      summary: typeof data.summary === "string" ? data.summary : "",
      notes: typeof data.notes === "string" ? data.notes : "",
      provenance: readProvenance(data.provenance),
    };
  } catch {
    return null;
  }
}
