import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "D:/НМТ Сайт/NMT-academy/qa-bio",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    screenshot: "only-on-failure",
    trace: "off",
  },
  outputDir: "D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-test-results",
});
