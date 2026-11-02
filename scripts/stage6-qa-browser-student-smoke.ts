import { chromium, type Page } from "playwright";

const BASE = process.env.STAGE6_QA_BASE_URL ?? "http://127.0.0.1:3010";
const STUDENT = "stage6_qa_student";
const PASSWORD = "stage6-qa-pass-2026";
const TOPICS = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder(/Нікнейм/i).fill(STUDENT);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
}

async function checkLesson(page: Page, topicId: string) {
  await page.goto(`${BASE}/learn/${topicId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  return {
    topicId,
    url: page.url(),
    hasTheoryTab: (await page.getByRole("tab", { name: "Теорія" }).count()) > 0,
    hasExamplesTab: (await page.getByRole("tab", { name: "Приклади" }).count()) > 0,
    hasPracticeTab: (await page.getByRole("tab", { name: "Практика" }).count()) > 0,
    hasVideoTab: (await page.getByRole("tab", { name: "Відеоурок" }).count()) > 0,
    iframeCount: await page.locator("iframe").count(),
    preparingMaterial: (await page.getByText("Матеріал готується").count()) > 0,
    horizontalOverflow: overflow,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await login(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  const desktop = [];
  for (const topicId of TOPICS) desktop.push(await checkLesson(page, topicId));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = [];
  for (const topicId of TOPICS) mobile.push(await checkLesson(page, topicId));

  await browser.close();
  const desktopPass = desktop.every(
    (r) => r.hasTheoryTab && r.hasExamplesTab && r.hasPracticeTab && !r.hasVideoTab && r.iframeCount === 0 && !r.preparingMaterial,
  );
  const mobilePass = mobile.every(
    (r) => r.hasTheoryTab && r.hasExamplesTab && r.hasPracticeTab && !r.hasVideoTab && !r.horizontalOverflow,
  );
  console.log(JSON.stringify({ base: BASE, desktopPass, mobilePass, desktop, mobile }, null, 2));
}

main();
