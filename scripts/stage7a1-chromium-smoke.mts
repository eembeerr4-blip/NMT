import { chromium, devices } from "@playwright/test";

const base = process.env.STAGE7A1_BASE_URL ?? "http://localhost:3013";
const password = process.env.STAGE7A1_OWNER_PASSWORD ?? "stage7a1-qa-smoke-2026";

async function assertDraftBlocked(page: import("@playwright/test").Page, path: string) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/, { timeout: 15000 });
}

async function loginOwner(page: import("@playwright/test").Page) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/Нікнейм або email/i).fill("owner");
  await page.getByLabel(/^Пароль$/i).fill(password);
  await page.getByRole("button", { name: "Увійти" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20000 });
}

async function assertEditorLesson(page: import("@playwright/test").Page, topicId: string, titleFragment: string) {
  await page.goto(`${base}/admin/lessons/${topicId}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(`/admin/lessons/${topicId}`), { timeout: 15000 });
  await page.getByRole("heading", { name: new RegExp(titleFragment, "i") }).first().waitFor({ timeout: 10000 });
  await page.getByText(/Чернетка\. Учні не бачать/i).waitFor({ timeout: 10000 });
  await page.getByRole("heading", { name: "Матеріал уроку" }).waitFor({ timeout: 10000 });
  const theory = page.getByLabel(/Пояснення з нуля/i);
  await theory.scrollIntoViewIfNeeded();
  const value = await theory.inputValue();
  if (value.trim().length < 600) throw new Error(`Theory too short for ${topicId}`);
  await page.getByText(/Приклад|приклад/i).first().scrollIntoViewIfNeeded();
}

async function main() {
  const browser = await chromium.launch();
  const results: { name: string; ok: boolean; detail?: string }[] = [];

  try {
    const desktop = await browser.newContext();
    const page = await desktop.newPage();
    for (const path of [
      "/learn/math-linear-eq-sub-02",
      "/learn/hist-galicia-sub-01",
      "/learn/geography-1",
    ]) {
      try {
        await assertDraftBlocked(page, path);
        results.push({ name: `anonymous draft block ${path}`, ok: true });
      } catch (error) {
        results.push({ name: `anonymous draft block ${path}`, ok: false, detail: String(error) });
      }
    }

    try {
      await loginOwner(page);
      results.push({ name: "owner login", ok: true });
      for (const [topicId, titleFragment] of [
        ["math-linear-eq-sub-02", "Лінійне рівняння"],
        ["hist-galicia-sub-01", "Об"],
        ["geography-1", "Загальна географія"],
      ] as const) {
        await assertEditorLesson(page, topicId, titleFragment);
        results.push({ name: `editor lesson ${topicId}`, ok: true });
      }
    } catch (error) {
      results.push({ name: "owner login / editor", ok: false, detail: String(error) });
    }
    await desktop.close();

    const mobile = await browser.newContext({ ...devices["iPhone 13"] });
    const mpage = await mobile.newPage();
    try {
      await loginOwner(mpage);
      await assertEditorLesson(mpage, "math-linear-eq-sub-02", "Лінійне");
      results.push({ name: "mobile editor math lesson", ok: true });
    } catch (error) {
      results.push({ name: "mobile editor math lesson", ok: false, detail: String(error) });
    }
    await mobile.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ base, results, pass: failed.length === 0 }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main();
