import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testIgnore: ["**/beta/**", "**/fresh/**"],
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3010" },
  webServer: {
    command: "npx tsx e2e/prepare.ts && node scripts/prisma-generate-safe.mjs && npx next build && npm run start",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      PORT: "3010",
      RESEND_API_KEY: "re_e2e_local_only",
      AUTH_EMAIL_FROM: "NMT E2E <e2e@localhost>",
      AUTH_BASE_URL: "http://127.0.0.1:3010",
      AUTH_MAIL_QA_ENDPOINT: "http://127.0.0.1:3010/api/internal/qa-mail",
    },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
