import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  testDir: "e2e/stage5",
  outputDir: "test-results/stage5",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3105",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 390, height: 844 },
  },
  projects: [{ name: "chromium", use: {} }],
  webServer: {
    command: "npx next start -p 3105",
    url: "http://127.0.0.1:3105/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      DATABASE_URL: "file:./prisma/stage5-qa.db",
      PORT: "3105",
    },
  },
});
