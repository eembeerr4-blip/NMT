import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const BASE = process.env.STAGE6_QA_BASE_URL ?? "http://127.0.0.1:3012";
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="password"]').fill("stage6-qa-pass-2026");
  await page.getByRole("button", { name: "Увійти" }).click();
  await page.waitForTimeout(3000);
  console.log("afterLogin", page.url());
  const alert = await page.getByRole("alert").allTextContents();
  console.log("alerts", alert);
  await page.goto(`${BASE}/learn/ukr-lex-01-meaning`);
  await page.waitForTimeout(2500);
  console.log("learnUrl", page.url());
  console.log("tabs", await page.getByRole("tab").allTextContents());
  console.log("headings", await page.locator("h1").allTextContents());
  console.log("snippet", (await page.locator("body").innerText()).slice(0, 800));
  await browser.close();
}

main();
