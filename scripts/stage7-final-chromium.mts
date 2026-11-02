/**
 * Stage 7 final learner smoke: 10 published topics, desktop + mobile viewports.
 */
import { chromium } from "@playwright/test";
import { STAGE7B_ALLOWLIST } from "./stage7b-allowlist.mjs";

const base = process.env.STAGE7_FINAL_BASE_URL ?? "http://localhost:3013";
const password = process.env.STAGE7A1_OWNER_PASSWORD ?? "stage7a1-qa-smoke-2026";

const TOPICS: { id: string; titlePart: string }[] = [
  { id: "geography-1", titlePart: "Загальна" },
  { id: "geography-2", titlePart: "України" },
  { id: "ukr-lexicology-section-01", titlePart: "Лексиколог" },
  { id: "ukr-ortho-sub-01", titlePart: "голосн" },
  { id: "math-linear-eq-sub-02", titlePart: "Лінійн" },
  { id: "math-quadratic-sub-01", titlePart: "Дискрим" },
  { id: "cm-history-slavs-sub-01", titlePart: "Венед" },
  { id: "hist-galicia-sub-01", titlePart: "княз" },
  { id: "bio-cell-sec-01", titlePart: "клітин" },
  { id: "zcode-biology-molecular-02", titlePart: "Молекул" },
];

async function login(page: import("@playwright/test").Page, nickname: string) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/Нікнейм або email/i).fill(nickname);
  await page.getByLabel(/^Пароль$/i).fill(password);
  await page.getByRole("button", { name: "Увійти" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 25000 });
}

async function checkLesson(page: import("@playwright/test").Page, topicId: string, titlePart: string) {
  await page.goto(`${base}/learn/${topicId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1 }).filter({ hasText: new RegExp(titlePart, "i") }).first().waitFor({
    timeout: 15000,
  });
  await page
    .getByRole("navigation", { name: /Шлях до уроку/i })
    .getByRole("link", { name: "Предмети" })
    .waitFor({ timeout: 5000 });
  const theoryTab = page.getByRole("tab", { name: /Теорія|теорія/i });
  if (await theoryTab.count()) {
    await theoryTab.first().click();
  }
  await page.getByText(/Пояснення|конспект|теор/i).first().waitFor({ timeout: 10000 });
  const examplesTab = page.getByRole("tab", { name: /Приклад/i });
  if (await examplesTab.count()) {
    await examplesTab.first().click();
    await page.getByText(/Приклад|приклад|Розв/i).first().waitFor({ timeout: 10000 });
  }
  const practiceTab = page.getByRole("tab", { name: /Практик|практик/i });
  if (await practiceTab.count()) {
    await practiceTab.first().click();
    await page.getByRole("heading", { name: /Перевірте розуміння теми/i }).waitFor({ timeout: 10000 });
  }
  await page.getByRole("link", { name: /До тем предмета/i }).first().waitFor({ timeout: 8000 });
}

async function runViewport(
  name: string,
  viewport: { width: number; height: number },
  isMobile: boolean,
) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  const results: { topicId: string; ok: boolean; detail?: string }[] = [];
  try {
    await login(page, "owner");
    for (const { id, titlePart } of TOPICS) {
      if (!STAGE7B_ALLOWLIST.includes(id)) continue;
      try {
        await checkLesson(page, id, titlePart);
        results.push({ topicId: id, ok: true });
      } catch (error) {
        results.push({ topicId: id, ok: false, detail: String(error) });
      }
    }
  } catch (error) {
    results.push({ topicId: "_login", ok: false, detail: String(error) });
  } finally {
    await context.close();
    await browser.close();
  }
  return { name, results, pass: results.every((r) => r.ok) };
}

async function main() {
  const desktop = await runViewport("desktop-1280x720", { width: 1280, height: 720 }, false);
  const mobile = await runViewport("mobile-390x844", { width: 390, height: 844 }, true);
  const desktopOk = desktop.results.filter((r) => r.ok && r.topicId !== "_login").length;
  const mobileOk = mobile.results.filter((r) => r.ok && r.topicId !== "_login").length;
  const out = {
    base,
    desktop: { ...desktop, topicsPass: `${desktopOk}/10` },
    mobile: { ...mobile, topicsPass: `${mobileOk}/10` },
    pass: desktop.pass && mobile.pass,
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main();
