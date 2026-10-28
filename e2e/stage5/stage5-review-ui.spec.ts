import { test, expect } from "@playwright/test";

test.describe("Stage 5A review UI smoke", () => {
  test("mistakes and review overview render without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.getByPlaceholder("Нікнейм").fill("stage5-smoke");
    await page.locator("input[type=password]").fill("stage5-smoke-pass");
    await page.getByRole("button", { name: "Увійти" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await page.goto("/mistakes");
    await expect(page.getByRole("heading", { name: "Мої помилки", exact: true })).toBeVisible();
    await expect(page.getByText("Відкриті помилки")).toBeVisible();
    const mistakesOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(mistakesOverflow).toBe(false);
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Повторення", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Прострочені", exact: true })).toBeVisible();
    const reviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(reviewOverflow).toBe(false);
  });
});
