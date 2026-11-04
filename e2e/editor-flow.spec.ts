import { expect, test, type Page } from "@playwright/test";
import { topicIdByTitle } from "./helpers/e2e-db";

const TOPIC_TITLE = "E2E Block4 тема";
const THEORY = "Автоматичний конспект Block4: достатній текст для доступності уроку учню після публікації матеріалу редактором платформи.";

async function login(page: Page, nickname: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill(nickname);
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

async function logoutMain(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Меню профілю" }).click();
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}

async function answerNumeric(page: Page) {
  const numeric = page.getByPlaceholder("Число");
  if (await numeric.count()) {
    await numeric.fill("4");
    return;
  }
  const radio = page.locator("input[type=radio]");
  if (await radio.count()) await radio.first().check();
}

test("редактор публікує тему, учень проходить практику", async ({ page }) => {
  await login(page, "e2e_editor");
  await expect(page.getByRole("heading", { name: /Привіт, E2E-Editor/ })).toBeVisible({ timeout: 15_000 });

  await page.goto("/editor/topics/math-numbers");
  await page.getByPlaceholder("Нова підтема").fill(TOPIC_TITLE);
  await page.getByRole("button", { name: "Додати підтему" }).click();
  await expect(page.getByText("Підтему створено.")).toBeVisible();

  let resolvedId = "";
  await expect.poll(async () => {
    resolvedId = (await topicIdByTitle(TOPIC_TITLE)) ?? "";
    return resolvedId;
  }, { timeout: 15_000 }).not.toBe("");

  await page.goto(`/editor/lessons/${resolvedId}`);
  await page.getByText("Редагувати матеріал уроку").click();
  await page.locator('textarea[name="theory"]').fill(THEORY);
  await page.getByRole("button", { name: "Зберегти матеріал" }).click();
  await expect(page.getByRole("status")).toContainText(/збережено/i);

  await page.getByText("Інструменти редактора відео").click();
  await page.getByPlaceholder("Посилання YouTube").fill("https://www.youtube.com/watch?v=abcdefghijk");
  await page.getByPlaceholder("Назва для себе").fill("Block4 лекція");
  await page.getByRole("button", { name: "Додати відео" }).click();
  await expect(page.getByRole("button", { name: "Запустити лекцію" })).toBeVisible();

  await page.goto("/editor/questions");
  await page.locator("details").filter({ hasText: "Створити завдання" }).locator("summary").click();
  await page.locator('select[name="subjectId"]').selectOption("math");
  await page.locator('select[name="topicId"]').selectOption(resolvedId);
  await page.locator('select[name="type"]').selectOption("NUMERIC");
  await page.locator('textarea[name="prompt"]').fill("E2E Block4: скільки буде 2+2?");
  await page.locator('textarea[name="explanation"]').fill("2+2=4");
  await page.locator('input[name="correctAnswer"]').fill("4");
  await page.getByRole("button", { name: "Створити завдання" }).click();
  await expect(page.getByText("Завдання збережено.")).toBeVisible();

  await page.goto(`/editor/questions?topic=${resolvedId}`);
  const card = page.getByRole("button", { name: "Позначити перевіреним" }).first();
  await card.click();
  await expect(page.getByRole("status").first()).toContainText(/збережено/i, { timeout: 15_000 });

  await logoutMain(page);
  await login(page, "e2e_student");
  await expect(page.getByRole("heading", { name: /Привіт, E2E/ })).toBeVisible({ timeout: 15_000 });

  await page.goto(`/learn/${resolvedId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(TOPIC_TITLE);
  await page.getByRole("tab", { name: "Практика" }).click();
  await page.getByRole("button", { name: "Пройти тест" }).click();
  await expect(page).toHaveURL(/\/tests\/[^/]+$/);
  await answerNumeric(page);
  await page.getByRole("button", { name: "Завершити" }).click();
  await page.getByRole("button", { name: "Так, завершити тест" }).click();
  await expect(page.getByRole("heading", { name: "Результат", level: 1 })).toBeVisible();

  await logoutMain(page);
  await login(page, "e2e_editor");
  await page.goto(`/editor/lessons/${resolvedId}`);
  await page.getByText("Редагувати матеріал уроку").click();
  await page.locator('textarea[name="theory"]').fill(`${THEORY} Оновлено.`);
  await page.getByRole("button", { name: "Зберегти матеріал" }).click();
  await expect(page.getByRole("status")).toContainText(/збережено/i);

  await logoutMain(page);
  await login(page, "e2e_student");
  await page.goto(`/learn/${resolvedId}`);
  await expect(page.getByText("Оновлено.")).toBeVisible();
});
