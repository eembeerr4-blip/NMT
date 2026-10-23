import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, nickname: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill(nickname);
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
}

async function skipDiagnosticIfShown(page: Page) {
  const panel = page.locator("details.d01-diagnostic");
  if (await panel.count()) {
    await panel.locator("summary").click();
  }
  const skip = page.getByRole("button", { name: "Пропустити", exact: true });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }
}

async function answerCurrentQuestion(page: Page) {
  const radio = page.locator("input[type=radio]");
  if (await radio.count()) {
    await radio.first().check();
    return;
  }
  const stepFinal = page.getByPlaceholder("Кінцева відповідь");
  if (await stepFinal.count()) {
    const stepWork = page.getByPlaceholder("Хід розв'язання");
    if (await stepWork.count()) await stepWork.fill("e2e");
    await stepFinal.fill("4");
    return;
  }
  const numeric = page.getByPlaceholder("Число");
  if (await numeric.count()) {
    await numeric.fill("4");
  }
}

test("учень A: план, урок, тест, пробник, вихід і повторний вхід", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "e2e_student");
  await expect(page.getByRole("heading", { name: /Привіт, E2E/ })).toBeVisible({ timeout: 15_000 });
  await skipDiagnosticIfShown(page);

  await page.goto("/subjects");
  await expect(page.getByRole("heading", { name: "Математика" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Українська мова" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Історія України" })).toBeVisible();

  await page.goto("/learn/math-linear-eq");
  await page.getByRole("tab", { name: "Практика" }).click();
  await page.getByRole("button", { name: "Пройти тест" }).click();
  await expect(page).toHaveURL(/\/tests\/[^/]+$/);
  const attemptUrl = page.url();
  const total = Number((await page.locator(".d05-eyebrow").textContent())?.match(/з (\d+)/)?.[1] ?? 1);
  for (let index = 0; index < total; index += 1) {
    await answerCurrentQuestion(page);
    if (index < total - 1) await page.getByRole("button", { name: "Далі" }).click();
  }
  await page.getByRole("button", { name: "Завершити" }).click();
  await page.getByRole("button", { name: "Так, завершити тест" }).click();
  await expect(page.getByRole("heading", { name: "Результат", level: 1 })).toBeVisible();

  await page.goto("/results?add=1");
  await page.getByLabel("Назва або джерело пробника").fill("E2E Student A mock");
  await page.getByLabel("Рейтинговий бал, якщо відомий").fill("142");
  await page.getByRole("button", { name: "Зберегти результат" }).click();
  await expect(page.getByText("E2E Student A mock")).toBeVisible();

  await page.getByRole("button", { name: "Меню профілю" }).click();
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, "e2e_student");
  await expect(page.getByRole("heading", { name: /Привіт, E2E/ })).toBeVisible({ timeout: 15_000 });
  await page.goto(attemptUrl);
  await expect(page.getByRole("heading", { name: "Результат", level: 1 })).toBeVisible();
  await page.goto("/results");
  await expect(page.getByText("E2E Student A mock")).toBeVisible();
});

test("учень B не бачить дані учня A; PENDING не потрапляє до навчання", async ({ page }) => {
  await login(page, "e2e_student_b");
  await expect(page.getByRole("heading", { name: /Привіт, E2E-B/ })).toBeVisible({ timeout: 15_000 });
  await page.goto("/results");
  await expect(page.getByText("E2E Student A mock")).toHaveCount(0);

  await page.getByRole("button", { name: "Меню профілю" }).click();
  await page.getByRole("button", { name: "Вийти" }).click();

  await login(page, "e2e_pending_guard");
  await expect(page).toHaveURL(/\/pending$/, { timeout: 15_000 });
  await page.goto("/subjects");
  await expect(page).toHaveURL(/\/pending$/);
});

test("мобільний шлях учня A (390px, темна тема)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "e2e_student");
  await expect(page.getByRole("heading", { name: /Привіт, E2E/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Змінити тему" }).click();
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Календар" })).toBeVisible();
  await page.getByRole("button", { name: "Відкрити меню" }).click();
  await expect(page.getByRole("navigation", { name: "Мобільна навігація" })).toBeVisible();
});
