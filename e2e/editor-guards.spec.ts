import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, nickname: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill(nickname);
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
}

test("редактор не відкриває адміністрування ролей і модерацію", async ({ page }) => {
  await login(page, "e2e_editor");
  await expect(page.getByRole("heading", { name: /Привіт, E2E-Editor/ })).toBeVisible({ timeout: 15_000 });

  for (const path of ["/admin/users", "/admin/moderation", "/admin/settings"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test("учень не відкриває робочий простір редактора", async ({ page }) => {
  await login(page, "e2e_student");
  await expect(page.getByRole("heading", { name: /Привіт, E2E/ })).toBeVisible({ timeout: 15_000 });

  const response = await page.goto("/editor/lessons");
  expect(response?.status()).toBe(404);
});
