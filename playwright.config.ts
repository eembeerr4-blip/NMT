import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "npx tsx e2e/prepare.ts && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: "file:./e2e.db" },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
