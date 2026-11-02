// Перевірка ukrainian-lexicology-01.package.json реальним валідатором NMT Academy (тільки «Перевірити пакет», без запису в БД).
import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const CRED = JSON.parse(fs.readFileSync("D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-credentials.json", "utf-8"));
const FILE = "D:/матерелы ТГК/_NMT_ПАКЕТИ/ukrainian/ukrainian-lexicology-01.package.json";

test("platform validator accepts ukrainian lexicology package (preview only)", async ({ page }) => {
  test.setTimeout(180000);
  await page.context().addCookies([{ name: "nmt_user", value: CRED.owner_token, url: BASE }]);
  await page.goto(`${BASE}/admin/import`);
  await expect(page.getByRole("heading", { name: "Імпорт навчальних матеріалів" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(FILE);
  await page.getByRole("button", { name: "Перевірити пакет" }).click();
  await expect(page.getByRole("status")).toContainText(/Пакет перевірено/i, { timeout: 30000 });
  const alerts = await page.locator('[role="alert"]').allInnerTexts();
  const preview = await page.locator("text=/розділів \\d+ · тем \\d+ · завдань \\d+/").innerText();
  console.log(`[ukrainian-lexicology-01] ${preview} | alerts: ${JSON.stringify(alerts)}`);
  await page.screenshot({ path: "D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-shots/validate-ukrainian-lexicology-01.png", fullPage: true });
  // Кнопку імпорту НЕ натискаємо — лише валідація прев'ю без запису в БД.
});

