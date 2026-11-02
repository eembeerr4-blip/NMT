import { defineConfig } from '@playwright/test';
export default defineConfig({
  expect: { timeout: 45000 }, testDir: 'e2e/station4', workers: 1, retries: 0, timeout: 600000,
  outputDir: process.env.STATION4_ARTIFACTS, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3154', headless: true, viewport: { width: 1280, height: 900 }, navigationTimeout: 90000, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: { command: 'node scripts/station4-qa-server.mjs', url: 'http://127.0.0.1:3154/login', reuseExistingServer: false, timeout: 180000 },
});
