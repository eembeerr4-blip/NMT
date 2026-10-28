import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { prepareQuestion } from "../src/lib/question-input";

const base = JSON.parse(
  readFileSync(path.join(process.cwd(), "content/stage6b/exported-questions-baseline.json"), "utf8"),
) as Array<{
  id: string;
  topicId: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  correctAnswer: string;
  options: { label: string; text: string; matchKey: string | null }[];
}>;

const summaries = base.map((q) => {
  let validation: string | null = null;
  try {
    prepareQuestion(
      {
        subjectId: q.topicId.startsWith("ukr") ? "ukrainian" : "biology",
        topicId: q.topicId,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        explanation: q.explanation,
        correctAnswer: q.correctAnswer,
        source: "",
        verificationStatus: "DRAFT",
        options: q.options.map((o) => ({
          id: o.id,
          label: o.label,
          text: o.text,
          matchKey: o.matchKey ?? undefined,
        })),
      },
      { preserveIds: true },
    );
  } catch (e) {
    validation = e instanceof Error ? e.message : String(e);
  }
  const optionTexts = q.options.map((o) => o.text.trim().toLowerCase());
  const dupOptions = optionTexts.length !== new Set(optionTexts).size;
  return {
    id: q.id,
    topicId: q.topicId,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    explanationLen: q.explanation.length,
    correctAnswer: q.correctAnswer,
    optionCount: q.options.length,
    dupOptions,
    validationError: validation,
  };
});

const prompts = summaries.map((s) => s.prompt.trim().toLowerCase().replace(/\s+/g, " "));
const dupPrompts = summaries.filter((s, i) => prompts.indexOf(prompts[i]) !== i);

mkdirSync(path.join(process.cwd(), "content/stage6b"), { recursive: true });
writeFileSync(
  path.join(process.cwd(), "content/stage6b/question-summaries.json"),
  JSON.stringify({ summaries, duplicatePromptIds: dupPrompts.map((d) => d.id) }, null, 2),
);
console.log(
  JSON.stringify(
    {
      total: summaries.length,
      validationErrors: summaries.filter((s) => s.validationError).length,
      dupOptions: summaries.filter((s) => s.dupOptions).length,
      dupPrompts: dupPrompts.length,
    },
    null,
    2,
  ),
);
