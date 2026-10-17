import { execSync } from "child_process";

export default function setup() {
  const env = { ...process.env, DATABASE_URL: "file:./e2e.db" };
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}
