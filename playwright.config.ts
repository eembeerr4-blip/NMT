import { defineConfig, devices } from "@playwright/test";

const port = process.env.NMT_E2E_PORT ?? "3010";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  // Historical stage suites require their own worktree and externally prepared QA fixtures.
  testIgnore: ["**/beta/**", "**/fresh/**", "**/stage5/**", "**/stage82/**"],
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL },
  webServer: {
    command: "npx tsx e2e/prepare.ts && node scripts/prisma-generate-safe.mjs && npx next build && npm run start",
    url: baseURL,
    reuseExistingServer: false,
    stdout: "pipe",
    // Includes disposable DB creation, content seeding and a production build.
    timeout: 600_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      PORT: port,
      RESEND_API_KEY: "re_e2e_local_only",
      AUTH_EMAIL_FROM: "NMT E2E <e2e@localhost>",
      AUTH_BASE_URL: baseURL,
      AUTH_MAIL_QA_ENDPOINT: `${baseURL}/api/internal/qa-mail`,
    },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
