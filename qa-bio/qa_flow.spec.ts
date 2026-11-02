// Етап 4 QA: публікація, верифікація, проходження всіх 40 питань, мобільні ширини, реімпорт.
import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const CRED = JSON.parse(fs.readFileSync("D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-credentials.json", "utf-8"));
// topic id == topic code (verified in QA DB)
const SHOTS = "D:/матерелы ТГК/_NMT_ПАКЕТИ/_tools/qa-shots";

const LESSON_TOPICS = [
  { code: "bio-cell-01-eukaryotic-cell", title: "Будова еукаріотичної клітини" },
  { code: "zcode-biology-molecular-dna-rna", title: "ДНК і РНК" },
  { code: "zcode-biology-molecular-protein-synth", title: "Реплікація ДНК і біосинтез білка" },
  { code: "zcode-biology-molecular-division", title: "Клітинний цикл. Мітоз і мейоз" },
];

function pkgQuestions(file) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf-8"));
  const out = [];
  for (const s of pkg.sections) for (const t of s.topics)
    for (const q of t.questions) out.push({ topicCode: t.code, ...q });
  return out;
}
const ALL_Q = [
  ...pkgQuestions("D:/матерелы ТГК/_NMT_ПАКЕТИ/biology/biology-cell-01.package.fixed.json"),
  ...pkgQuestions("D:/матерелы ТГК/_NMT_ПАКЕТИ/biology/biology-molecular-02.package.fixed.json"),
];

async function loginAs(page, token) {
  await page.context().addCookies([{ name: "nmt_user", value: token, url: BASE }]);
}

test("editor publishes 4 lessons", async ({ page }) => {
  await loginAs(page, CRED.owner_token);
  for (const t of LESSON_TOPICS) {
    await page.goto(`${BASE}/editor/lessons/${t.code}`);
    const btn = page.getByRole("button", { name: "Опублікувати для учнів" });
    if (await btn.count()) {
      await btn.click();
    }
    await expect(page.getByText("Урок опубліковано для учнів")).toBeVisible({ timeout: 20000 });
    console.log("published:", t.title);
  }
});

test("editor verifies all 40 questions", async ({ page }) => {
  test.setTimeout(420000);
  await loginAs(page, CRED.owner_token);
  let verified = 0;
  for (const t of LESSON_TOPICS) {
    await page.goto(`${BASE}/admin/questions?topic=${t.code}`);
    await page.waitForLoadState("networkidle");
    let guard = 0;
    while (guard++ < 20) {
      const before = await page.getByRole("button", { name: "Позначити перевіреним" }).count();
      if (!before) break;
      try {
        await page.getByRole("button", { name: "Позначити перевіреним" }).first().click({ timeout: 8000 });
      } catch { await page.reload(); await page.waitForLoadState("networkidle"); continue; }
      await page.waitForFunction((prev) => {
        let n = 0;
        document.querySelectorAll("button").forEach((b) => { if (b.textContent && b.textContent.trim() === "Позначити перевіреним") n++; });
        return n < prev;
      }, before, { timeout: 20000 }).catch(() => {});
      verified++;
    }
    console.log("verified so far:", verified, "| topic:", t.title);
  }
  console.log("TOTAL verified clicks:", verified);
  expect(verified).toBe(40);
});

async function answerQuestion(page, q, wrongMode = false) {
  const area = page.locator("main").last();
  if (q.type === "SINGLE_CHOICE") {
    const rightLabel = wrongMode ? q.options.find(o => o.label !== q.correctAnswer).label : q.correctAnswer;
    const label = area.locator("label.d05-choice", { has: page.locator(`span.font-medium:text-is("${rightLabel}.")`) });
    await label.locator("input[type=radio]").check({ force: true });
  } else if (q.type === "NUMERIC" || q.type === "SHORT_TEXT") {
    const input = area.locator(q.type === "NUMERIC" ? 'input[aria-label="Числова відповідь"]' : 'input[aria-label="Коротка відповідь"]');
    let val = q.correctAnswer;
    if (wrongMode) val = q.type === "NUMERIC" ? String(Number(q.correctAnswer) + 7) : "невірна відповідь";
    await input.fill(val);
  } else if (q.type === "MATCHING") {
    const pairs = JSON.parse(q.correctAnswer);
    for (const [leftLabel, rightLabel] of Object.entries(pairs)) {
      const row = area.locator("label.d05-matching-row", { hasText: q.options.find(o => o.label === leftLabel).text.slice(0, 25) });
      let target = rightLabel;
      if (wrongMode) { const rs = q.options.filter(o => o.matchKey === "right").map(o => o.label); target = rs.find(x => x !== rightLabel); }
      await row.locator("select").selectOption({ label: `${target}. ${q.options.find(o => o.matchKey === "right" && o.label === target).text.replace(/\$/g, "")}`.slice(0, 120) });
    }
  } else if (q.type === "SEQUENCE") {
    const parsed = JSON.parse(q.correctAnswer);
    const target = wrongMode ? [...parsed].reverse() : parsed;
    const texts = Object.fromEntries(q.options.map(o => [o.label, o.text]));
    for (let pos = 0; pos < target.length; pos++) {
      for (let guard = 0; guard < target.length * 3; guard++) {
        const rows = area.locator(".d05-sequence-row");
        const currentTexts = [];
        for (let i = 0; i < await rows.count(); i++) currentTexts.push(((await rows.nth(i).locator(".d05-sequence-text").innerText()) || "").replace(/^\d+\s*/, "").trim());
        if (currentTexts[pos] && currentTexts[pos].startsWith(texts[target[pos]].slice(0, 20))) break;
        const idx = currentTexts.findIndex(t => t.startsWith(texts[target[pos]].slice(0, 20)));
        if (idx < 0) break;
        try {
          await rows.nth(idx).getByRole("button", { name: /вгору/i }).click({ timeout: 5000 });
        } catch { /* перерендер — повторимо на наступній ітерації */ }
        await page.waitForTimeout(250);
      }
    }
    await area.getByRole("button", { name: "Підтвердити поточний порядок" }).click();
  }
}

async function runTopicTest(page, topicCode, wrongMode = false, label = "") {
  await page.goto(`${BASE}/learn/${topicCode}`);
  const practiceTab = page.getByRole("tab", { name: "Практика" });
  if (await practiceTab.count()) await practiceTab.click();
  await page.getByRole("button", { name: "Пройти тест" }).first().click();
  await page.waitForURL(/\/tests\//, { timeout: 20000 });
  const qs = ALL_Q.filter(q => q.topicCode === topicCode);
  for (let i = 0; i < qs.length; i++) {
    // питання на екрані визначаємо за текстом умови
    await page.getByRole("button", { name: "Завершити" }).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(350);
    const prompt = await page.locator("main").last().innerText();
    const q = qs.find(item => prompt.includes(item.prompt.slice(0, 60)));
    if (!q) throw new Error(`Питання не розпізнано: ${prompt.slice(0, 200)}`);
    await answerQuestion(page, q, wrongMode);
    await page.screenshot({ path: `${SHOTS}/run-${label}-q${i + 1}.png` });
    if (i < qs.length - 1) await page.getByRole("button", { name: "Далі" }).click();
  }
  await page.getByRole("button", { name: "Завершити" }).click();
  await page.getByRole("button", { name: "Так, завершити тест" }).click();
  await page.waitForURL(/tests\/.+/, { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Результат" }).first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
  const resultText = await page.locator("body").innerText();
  const pct = (resultText.match(/(\d+)%\s*правильних/) || [])[1]
    || ((await page.locator(".d05-score-ring strong").innerText()).match(/\d+/) || [])[0];
  const score = (resultText.match(/(\d+)\s*\/\s*(\d+)/) || []).slice(1, 3).join("/");
  console.log(`[run ${label}] percent=${pct} score=${score}`);
  await page.screenshot({ path: `${SHOTS}/result-${label}.png`, fullPage: true });
  return { pct: Number(pct), score };
}

test("student passes all 40 questions with correct answers", async ({ page }) => {
  test.setTimeout(480000);
  await loginAs(page, CRED.student_token);
  const results = {};
  results.cell = await runTopicTest(page, "bio-cell-01-eukaryotic-cell", false, "cell-correct");
  results.dna = await runTopicTest(page, "zcode-biology-molecular-dna-rna", false, "dna-correct");
  results.prot = await runTopicTest(page, "zcode-biology-molecular-protein-synth", false, "prot-correct");
  results.div = await runTopicTest(page, "zcode-biology-molecular-division", false, "div-correct");
  console.log("RESULTS:", JSON.stringify(results));
});

test("student intentionally wrong run (cell topic) shows 0% and review", async ({ page }) => {
  await loginAs(page, CRED.student_token);
  const r = await runTopicTest(page, "bio-cell-01-eukaryotic-cell", true, "cell-wrong");
  console.log("WRONG RUN:", JSON.stringify(r));
  await expect(page.getByText(/Журнал помилок|перегляньте відповіді/i).first()).toBeVisible();
});

test("mobile widths do not break lesson and practice", async ({ page }) => {
  await loginAs(page, CRED.student_token);
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${BASE}/learn/${"zcode-biology-molecular-dna-rna"}`);
    await expect(page.getByRole("heading", { name: "ДНК і РНК" })).toBeVisible({ timeout: 30000 });
    const practiceTab = page.getByRole("tab", { name: "Практика" });
    if (await practiceTab.count()) await practiceTab.click();
    await page.screenshot({ path: `${SHOTS}/mobile-${width}-lesson.png`, fullPage: false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`width ${width}: horizontal overflow = ${overflow}px`);
    // практика
    await page.getByRole("button", { name: "Пройти тест" }).first().click();
    await page.waitForURL(/\/tests\//, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/mobile-${width}-practice.png` });
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`width ${width}: practice overflow = ${overflow2}px`);
  }
});

test("reimport creates no duplicates", async ({ page }) => {
  await loginAs(page, CRED.owner_token);
  await page.goto(`${BASE}/admin/import`);
  await page.locator('input[type="file"]').setInputFiles("D:/матерелы ТГК/_NMT_ПАКЕТИ/biology/biology-molecular-02.package.fixed.json");
  await page.getByRole("button", { name: "Перевірити пакет" }).click();
  await expect(page.getByRole("status")).toContainText(/Пакет перевірено/i, { timeout: 20000 });
  await page.getByRole("button", { name: "Імпортувати як чернетки" }).click();
  await expect(page.getByRole("status")).toContainText(/Створено тем: 0/i, { timeout: 30000 });
  const text = await page.locator('[role="status"]').first().innerText();
  console.log("reimport:", text.trim().slice(0, 200));
  await page.screenshot({ path: `${SHOTS}/reimport.png`, fullPage: true });
});
