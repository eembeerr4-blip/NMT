import { execSync } from "child_process";
import { rmSync } from "fs";

for (const file of ["prisma/e2e.db", "prisma/e2e.db-journal", "prisma/e2e.db-wal", "prisma/e2e.db-shm"]) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(file, { force: true });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
}
const env = { ...process.env, DATABASE_URL: "file:./e2e.db" };
execSync("npx prisma db push --skip-generate --accept-data-loss", { env, stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
execSync("npx tsx prisma/migrate-owner.ts", { env, stdio: "inherit" });
execSync("npx tsx e2e/bootstrap.ts", { env, stdio: "inherit" });
