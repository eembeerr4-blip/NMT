import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

let count = 0;
function verify(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) verify(file);
    else if (entry.name.endsWith(".json")) {
      try {
        JSON.parse(readFileSync(file, "utf8"));
      } catch (error) {
        throw new Error(`Invalid content JSON: ${file}`, { cause: error });
      }
      count++;
    }
  }
}
verify("prisma/content");
verify("content");
console.log(`Validated ${count} content JSON files; no database accessed.`);
