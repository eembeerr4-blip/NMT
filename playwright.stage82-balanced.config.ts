import { defineConfig } from "@playwright/test";
export default defineConfig({
  expect: { timeout: 45000 },
  testDir: "e2e/stage82", testMatch: "balanced-pilot.spec.ts", workers: 1, retries: 0, timeout: 600000,
  outputDir: ".stage82-browser", reporter: "list",
  use: { baseURL: "http://127.0.0.1:3148", headless: true, viewport: { width: 1280, height: 900 }, actionTimeout: 20000, navigationTimeout: 90000, trace: "off" },
  webServer: { command: "node scripts/stage82-balanced-qa-server.mjs", url: "http://127.0.0.1:3148/login", reuseExistingServer: false, timeout: 180000 },
});
