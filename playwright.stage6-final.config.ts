import { defineConfig } from "@playwright/test";

const PORT = 3117;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e/stage6",
  testMatch: "stage6-final-release.spec.ts",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: "test-results/stage6-final",
  reporter: "list",
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { channel: "chrome", viewport: { width: 1280, height: 720 } } }],
  globalSetup: "./e2e/stage6/global-setup.ts",
  webServer: {
    command: "node scripts/stage6-final-qa-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
