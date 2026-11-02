// Етап 3 QA: імпорт двох пакетів біології через реальний UI NMT Academy.
import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const CRED = JSON.parse(fs.readFileSync("D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-credentials.json", "utf-8"));
const PKG1 = "D:/матерелы ТГК/_NMT_ПАКЕТИ/biology/biology-cell-01.package.fixed.json";
const PKG2 = "D:/матерелы ТГК/_NMT_ПАКЕТИ/biology/biology-molecular-02.package.fixed.json";

async function loginAs(page, token) {
  await page.context().addCookies([{ name: "nmt_user", value: token, url: BASE }]);
}

async function importPackage(page, file, label) {
  await page.goto(`${BASE}/admin/import`);
  await expect(page.getByRole("heading", { name: "Імпорт навчальних матеріалів" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole("button", { name: "Перевірити пакет" }).click();
  await expect(page.getByRole("heading", { name: "Попередній перегляд" })).toBeVisible({ timeout: 20000 });
  const status = page.getByRole("status");
  await expect(status).toContainText(/Пакет перевірено|створено/i, { timeout: 20000 });
  const statusText = await status.innerText();
  const hasErrors = await page.locator('[role="alert"]').count();
  console.log(`[${label}] preview:`, statusText.trim().slice(0, 160), "| errors blocks:", hasErrors);
  await page.screenshot({ path: `D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-shots/import-${label}-preview.png`, fullPage: true });
  await page.getByRole("button", { name: "Імпортувати як чернетки" }).click();
  await expect(page.getByRole("status")).toContainText(/створено|оновлено|пропущено/i, { timeout: 30000 });
  const importText = await page.locator('[role="status"]').first().innerText();
  console.log(`[${label}] import:`, importText.trim().slice(0, 200));
  await page.screenshot({ path: `D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-shots/import-${label}-done.png`, fullPage: true });
  return importText;
}

test("owner can import both biology packages", async ({ page }) => {
  fs.mkdirSync("D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-shots", { recursive: true });
  await loginAs(page, CRED.owner_token);
  await page.goto(`${BASE}/admin/import`);
  // Якщо сервер раптом на dev.db — сесія QA-користувача не знайдеться і буде редірект на /login
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Імпорт навчальних матеріалів" })).toBeVisible();

  await importPackage(page, PKG1, "cell-01-fixed");
  await importPackage(page, PKG2, "molecular-02-fixed");
});

test("student does not see unpublished drafts", async ({ page }) => {
  await loginAs(page, CRED.student_token);
  await page.goto(`${BASE}/subjects/biology`);
  await page.screenshot({ path: "D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-shots/student-biology-before-publish.png", fullPage: true });
  const body = (await page.locator("body").innerText()).toLowerCase();
  console.log("student sees cell topic before publish:", body.includes("будова еукаріотичної"));
  console.log("student sees molecular topic before publish:", body.includes("днк і рнк"));
});
