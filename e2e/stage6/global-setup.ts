import { execFileSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  const root = process.cwd();
  execFileSync(process.execPath, [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/stage6-final-e2e-prep.ts"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: `file:${path.join(root, "prisma", "stage6-final-qa.db").replaceAll("\\", "/")}` },
  });
}
