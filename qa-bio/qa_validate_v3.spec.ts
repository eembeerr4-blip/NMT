// Перевірка .fixed-v3.json реальним валідатором NMT Academy (тільки «Перевірити пакет», без запису).
import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const CRED = JSON.parse(fs.readFileSync("D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-credentials.json", "utf-8"));
const FILES = [
  ["cell-01-v3", "D:/матерелы ТГК/_NMT_ПАКЕТИ/biology/biology-cell-01.package.fixed-v3.json"],
  ["molecular-02-v3", "D:/матерелы ТГК/_NMT_ПАКЕТИ/biology/biology-molecular-02.package.fixed-v3.json"],
];

test("platform validator accepts both fixed-v3 packages (preview only)", async ({ page }) => {
  test.setTimeout(180000);
  await page.context().addCookies([{ name: "nmt_user", value: CRED.owner_token, url: BASE }]);
  for (const [label, file] of FILES) {
    await page.goto(`${BASE}/admin/import`);
    await expect(page.getByRole("heading", { name: "Імпорт навчальних матеріалів" })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole("button", { name: "Перевірити пакет" }).click();
    await expect(page.getByRole("status")).toContainText(/Пакет перевірено/i, { timeout: 30000 });
    const alerts = await page.locator('[role="alert"]').allInnerTexts();
    const preview = await page.locator("text=/розділів \\d+ · тем \\d+ · завдань \\d+/").innerText();
    console.log(`[${label}] ${preview} | alerts: ${JSON.stringify(alerts)}`);
    await page.screenshot({ path: `D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-shots/validate-${label}.png`, fullPage: true });
    // Кнопку імпорту НЕ натискаємо — лише валідація прев'ю без запису в БД.
  }
});

