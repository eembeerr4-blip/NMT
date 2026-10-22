import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, nickname: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill(nickname);
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
}

test("власник схвалює заявку, після чого учень проходить onboarding", async ({ page }) => {
  await login(page, "e2e_pending");
  await expect(page).toHaveURL(/\/pending$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

  await login(page, "owner");
  await expect(page.getByRole("heading", { name: /Привіт/ })).toBeVisible({ timeout: 15_000 });
  await page.goto("/admin/moderation");
  await expect(page.getByRole("heading", { name: "Модерація реєстрацій" })).toBeVisible();
  await page.locator("div.flex.flex-col.gap-3").filter({ hasText: "e2e-pending@example.test" }).getByRole("button", { name: "Схвалити" }).click();
  await expect(page.getByRole("status").filter({ hasText: "схвалено" })).toBeVisible();
  await page.getByRole("button", { name: "Вийти" }).click();

  await login(page, "e2e_pending");
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
});
