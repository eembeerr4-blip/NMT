import { expect, test, type Page } from "@playwright/test";

const primaryNav = [
  { href: "/", label: "Головна" },
  { href: "/subjects", label: "Предмети" },
  { href: "/calendar", label: "Календар" },
  { href: "/tests", label: "Тести" },
  { href: "/analytics", label: "Прогрес" },
] as const;

async function loginStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Нікнейм або email", { exact: true }).fill("e2e_student");
  await page.getByLabel("Пароль", { exact: true }).fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBeFalsy();
}

test.describe("основна навігація учня", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudent(page);
  });

  test("мобільна нижня панель підсвічує активний розділ і зберігається після reload", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const bottom = page.getByRole("navigation", { name: "Швидка навігація" });

    for (const item of primaryNav) {
      await page.goto(item.href);
      await expect(bottom.getByRole("link", { name: item.label, exact: true })).toHaveAttribute("aria-current", "page");
      await page.reload();
      await expect(bottom.getByRole("link", { name: item.label, exact: true })).toHaveAttribute("aria-current", "page");
    }
  });

  test("урок і тема підсвічують «Предмети»", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn/math-linear-eq");
    await expect(page.getByRole("navigation", { name: "Швидка навігація" }).getByRole("link", { name: "Предмети" })).toHaveAttribute("aria-current", "page");
    await page.goto("/topics/math-linear-eq");
    await expect(page.getByRole("navigation", { name: "Швидка навігація" }).getByRole("link", { name: "Предмети" })).toHaveAttribute("aria-current", "page");
  });

  test("маршрут навчання без горизонтального скролу (390 і 320)", async ({ page }) => {
    const routes = ["/subjects", "/calendar", "/curriculum", "/tests", "/analytics", "/settings", "/learn/math-linear-eq", "/login"];
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of routes) {
        if (route === "/login") {
          await page.goto("/login");
        } else {
          await page.goto(route);
        }
        await assertNoPageOverflow(page);
      }
    }
  });

  test("світла й темна тема на головних екранах", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const route of ["/subjects", "/calendar", "/tests", "/analytics", "/settings"]) {
      await page.goto(route);
      const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      await page.getByRole("button", { name: "Змінити тему" }).click();
      await expect.poll(async () => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(!before);
      await assertNoPageOverflow(page);
    }
  });
});
