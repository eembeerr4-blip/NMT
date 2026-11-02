import { expect, test, type Page } from "@playwright/test";

const EDITOR = "stage6_qa_editor";
const STUDENT = "stage6_qa_student";
const PASSWORD = "stage6-qa-pass-2026";
const PRIMARY_TOPIC = "ukr-lex-01-meaning";
const ALL_TOPICS = [
  "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom",
  "ukr-lex-03-phraseology",
  "bio-cell-01-eukaryotic-cell",
  "zcode-biology-molecular-dna-rna",
  "zcode-biology-molecular-protein-synth",
  "zcode-biology-molecular-division",
];

async function login(page: Page, nickname: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill(nickname);
  await page.locator("input[type=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function answerCurrentQuestion(page: Page) {
  const radio = page.locator("input[type=radio]");
  if (await radio.count()) {
    await radio.first().check();
    return;
  }
  const numeric = page.getByPlaceholder("Число");
  if (await numeric.count()) await numeric.fill("1");
}

test.describe.configure({ mode: "serial" });

test("12 · anonymous cannot publish", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`/editor/lessons/${PRIMARY_TOPIC}`);
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});

test("1-2 · editor preview vs student block on DRAFT", async ({ page }) => {
  await login(page, EDITOR);
  await page.goto(`/learn/${PRIMARY_TOPIC}`);
  await expect(page.getByText(/Чернетка\. Учні цього уроку/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Теорія" })).toBeVisible();

  await login(page, STUDENT);
  await page.goto(`/learn/${PRIMARY_TOPIC}`);
  await expect(page.getByText("Матеріал готується")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Теорія" })).toHaveCount(0);
});

test("3-4 · editor publishes text-only; student sees theory", async ({ page }) => {
  await login(page, EDITOR);
  for (const topicId of ALL_TOPICS) {
    await page.goto(`/editor/lessons/${topicId}`);
    await page.getByRole("button", { name: "Опублікувати для учнів" }).click();
    await expect(page.getByText(/опубліковано/i)).toBeVisible({ timeout: 15_000 });
  }

  await login(page, STUDENT);
  await page.goto(`/learn/${PRIMARY_TOPIC}`);
  await expect(page.getByRole("tab", { name: "Теорія" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Приклади" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Практика" })).toBeVisible();
});

test("9-10 · suggested video hidden; no empty player tab", async ({ page }) => {
  await login(page, STUDENT);
  await page.goto(`/learn/${PRIMARY_TOPIC}`);
  await expect(page.getByRole("tab", { name: "Відеоурок" })).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("5-7 · student topic test saves result", async ({ page }) => {
  await login(page, STUDENT);
  await page.goto(`/learn/${PRIMARY_TOPIC}`);
  await page.getByRole("tab", { name: "Практика" }).click();
  await page.getByRole("button", { name: "Пройти тест" }).click();
  await expect(page).toHaveURL(/\/tests\/[^/]+$/, { timeout: 20_000 });
  const total = Number((await page.locator(".d05-eyebrow").textContent())?.match(/з (\d+)/)?.[1] ?? 12);
  for (let index = 0; index < total; index += 1) {
    await answerCurrentQuestion(page);
    if (index < total - 1) await page.getByRole("button", { name: "Далі", exact: true }).click();
  }
  await page.getByRole("button", { name: "Завершити", exact: true }).click();
  await page.getByRole("button", { name: "Так, завершити тест" }).click();
  await expect(page.getByRole("heading", { name: "Результат", level: 1 })).toBeVisible({ timeout: 30_000 });
});

test("viewport 390 · student lesson tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, STUDENT);
  await page.goto(`/learn/${PRIMARY_TOPIC}`);
  await expect(page.getByRole("tab", { name: "Теорія" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Відеоурок" })).toHaveCount(0);
});

test("8 · mistakes and review routes stay available", async ({ page }) => {
  await login(page, STUDENT);
  await page.goto("/mistakes");
  await expect(page.getByRole("heading", { name: /помилк/i })).toBeVisible();
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Повторення" })).toBeVisible();
});

test("11 · confirmed video tab without republish", async ({ page }) => {
  await login(page, EDITOR);
  await page.goto(`/editor/lessons/${PRIMARY_TOPIC}`);
  const confirm = page.getByRole("button", { name: "Підтвердити" }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
    await expect(page.getByText(/CONFIRMED|підтверджено/i).first()).toBeVisible({ timeout: 10_000 }).catch(() => undefined);
  }

  await login(page, STUDENT);
  await page.goto(`/learn/${PRIMARY_TOPIC}`);
  await expect(page.getByRole("tab", { name: "Відеоурок" })).toBeVisible({ timeout: 15_000 });
});
