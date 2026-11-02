import { chromium } from "playwright";

const TOPICS = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

async function checkLesson(page: import("playwright").Page, topicId: string) {
  await page.goto(`http://localhost:3000/learn/${topicId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  return {
    topicId,
    url: page.url(),
    onLoginPage: page.url().includes("/login"),
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

  await page.setViewportSize({ width: 1280, height: 720 });
  const desktop = [];
  for (const topicId of TOPICS) desktop.push(await checkLesson(page, topicId));

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = [];
  for (const topicId of TOPICS) mobile.push(await checkLesson(page, topicId));

  await page.context().clearCookies();
  await page.goto("http://localhost:3000/login");
  await page.getByPlaceholder(/Нікнейм/i).fill("owner");
  await page.locator('input[type="password"]').fill("definitely-wrong-password-2026");
  await page.getByRole("button", { name: "Увійти" }).click();
  await page.waitForTimeout(1200);
  const loginErrorShown = (await page.getByRole("alert").count()) > 0;

  await page.context().clearCookies();
  await page.goto("http://localhost:3000/editor/lessons/ukr-lex-01-meaning");
  await page.waitForTimeout(800);
  const editorAnonymousRedirect = page.url().includes("/login");

  await browser.close();
  console.log(JSON.stringify({ desktop, mobile, loginErrorShown, editorAnonymousRedirect, note: "Anonymous context — not authenticated student" }, null, 2));
}

main();
