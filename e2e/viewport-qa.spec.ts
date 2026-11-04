import { expect, test } from "@playwright/test";

async function login(nickname: string, page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Нікнейм або email").fill(nickname);
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page.getByRole("heading", { name: /Привіт/ })).toBeVisible({ timeout: 15_000 });
}

test.describe("tablet 768px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
  });

  test("адмін: банк завдань, таблиця тестів; модерація лише для власника", async ({ page }) => {
    await login("e2e_admin", page);
    const questions = await page.goto("/admin/questions");
    expect(questions?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Банк завдань" })).toBeVisible();

    await page.goto("/admin/tests");
    await expect(page.locator("table.responsive-table").first()).toBeVisible();

    const moderation = await page.goto("/admin/moderation");
    expect(moderation?.status()).toBe(404);
  });

  test("редактор: список тестів і форма створення", async ({ page }) => {
    await login("e2e_editor", page);
    await page.goto("/editor/tests");
    await expect(page.getByRole("heading", { name: "Тести та запитання" })).toBeVisible();
    await page.getByRole("link", { name: "Створити набір" }).click();
    await expect(page.getByRole("heading", { name: "Новий набір тесту" })).toBeVisible();
  });

  test("власник: модерація реєстрацій", async ({ page }) => {
    await login("owner", page);
    await page.goto("/admin/moderation");
    await expect(page.getByRole("heading", { name: "Модерація реєстрацій" })).toBeVisible();
    await expect(page.locator("div.flex.flex-col.gap-3").first()).toBeVisible();
  });
});
