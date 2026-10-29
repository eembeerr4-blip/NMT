import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(
  readFileSync(path.join(repoRoot, "content/stage7a/packages-v2/stage7a1-math.package.json"), "utf8"),
);

const issues = [];
for (const section of pkg.sections) {
  for (const topic of section.topics) {
    for (const q of topic.questions) {
      const opt = Object.fromEntries(q.options.map((o) => [o.label, o.text]));
      const ans = opt[q.correctAnswer];
      if (!ans) {
        issues.push({ id: q.code, problem: "correctAnswer label missing in options" });
        continue;
      }
      const expl = q.explanation;
      if (q.code === "s7a-math-linear-eq-sub-02-e11") {
        if (q.correctAnswer !== "Б" || !expl.includes("11/3")) {
          issues.push({
            id: q.code,
            problem: "Key must be Б (11/3); marked " + q.correctAnswer,
            expectedLabel: "Б",
          });
        }
      }
      if (expl.includes("=") && /x\s*=/.test(expl)) {
        const m = expl.match(/x\s*=\s*(-?\d+(?:\/\d+)?|-?\d+\/\d+|-?\d+)/);
        if (m) {
          const val = m[1];
          if (!ans.includes(val) && !(val === "11/3" && ans.includes("11/3"))) {
            const matching = q.options.find((o) => o.text.replace(/\s/g, "") === val.replace(/\s/g, ""));
            if (matching && matching.label !== q.correctAnswer) {
              issues.push({
                id: q.code,
                problem: `Explanation gives x=${val}, option ${matching.label}, but correctAnswer=${q.correctAnswer}`,
              });
            }
          }
        }
      }
    }
  }
}
console.log(JSON.stringify(issues, null, 2));
