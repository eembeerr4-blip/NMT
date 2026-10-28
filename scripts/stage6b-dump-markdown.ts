import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type Q = {
  id: string;
  topicId: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  correctAnswer: string;
  options: { id: string; label: string; text: string; matchKey: string | null }[];
};

const base = JSON.parse(
  readFileSync(path.join(process.cwd(), "content/stage6b/exported-questions-baseline.json"), "utf8"),
) as Q[];

function resolveAnswer(q: Q): string {
  if (q.type === "NUMERIC" || q.type === "SHORT_TEXT") return q.correctAnswer;
  if (q.type === "SINGLE_CHOICE") {
    const o = q.options.find((x) => x.id === q.correctAnswer || x.label === q.correctAnswer);
    return o ? `${o.label}) ${o.text}` : q.correctAnswer;
  }
  if (q.type === "MATCHING") {
    try {
      const map = JSON.parse(q.correctAnswer) as Record<string, string>;
      return JSON.stringify(
        Object.fromEntries(
          Object.entries(map).map(([l, r]) => {
            const left = q.options.find((o) => o.id === l || o.label === l);
            const right = q.options.find((o) => o.id === r || o.label === r);
            return [`${left?.label ?? l}: ${left?.text ?? "?"}`, `${right?.label ?? r}: ${right?.text ?? "?"}`];
          }),
        ),
      );
    } catch {
      return q.correctAnswer;
    }
  }
  return q.correctAnswer;
}

const topics = [...new Set(base.map((b) => b.topicId))].sort();
let md = "# Stage 6B question dump\n\n";
for (const topicId of topics) {
  md += `## ${topicId}\n\n`;
  for (const q of base.filter((b) => b.topicId === topicId)) {
    md += `### ${q.id} (${q.difficulty}, ${q.type})\n\n`;
    md += `${q.prompt}\n\n`;
    if (q.options.length) {
      md += "Options:\n";
      for (const o of q.options) {
        md += `- ${o.label}${o.matchKey ? ` [${o.matchKey}]` : ""}: ${o.text}\n`;
      }
      md += "\n";
    }
    md += `**Answer:** ${resolveAnswer(q)}\n\n`;
    md += `Explanation: ${q.explanation.slice(0, 400)}${q.explanation.length > 400 ? "…" : ""}\n\n---\n\n`;
  }
}

mkdirSync(path.join(process.cwd(), "content/stage6b"), { recursive: true });
writeFileSync(path.join(process.cwd(), "content/stage6b/questions-review-dump.md"), md);
console.log("lines", md.split("\n").length);
