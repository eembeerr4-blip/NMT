import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, nickname: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill(nickname);
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test("імпортована чернетка недоступна учню, а неповний приклад не можна опублікувати", async ({ page }) => {
  await login(page, "owner");
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Імпорт навчальних матеріалів" })).toBeVisible();
  await page.locator("input[type=file]").setInputFiles(path.join(process.cwd(), "docs/content/examples/biology-cell.package.json"));
  await page.getByRole("button", { name: "Перевірити пакет" }).click();
  await expect(page.getByRole("heading", { name: "Попередній перегляд" })).toBeVisible();
  await expect(page.getByText("Біологія")).toBeVisible();
  await expect(page.getByRole("button", { name: "Імпортувати як чернетки" })).toBeEnabled();
  await page.getByRole("button", { name: "Імпортувати як чернетки" }).click();
  await page.getByRole("alertdialog", { name: "Підтвердьте імпорт" }).getByRole("button", { name: "Так, імпортувати чернетки" }).click();
  await expect(page.getByText(/Створено тем:|Оновлено чернеток:/)).toBeVisible();

  await login(page, "e2e_student");
  await page.goto("/learn/pkg-example-cell-structure");
  await expect(page.getByText("Матеріал готується")).toBeVisible();
  await expect(page.getByText("Еукаріотична клітина має мембрану")).toHaveCount(0);

  const edited = "Оновлений конспект імпортованого прикладу після редагування чернетки. Учень побачить цей текст лише після окремої публікації уроку.";
  await login(page, "owner");
  await page.goto("/admin/lessons/pkg-example-cell-structure");
  await page.getByText("Редагувати матеріал уроку").click();
  await page.locator("textarea[name=theory]").fill(edited);
  await page.getByRole("button", { name: "Зберегти матеріал" }).click();
  await expect(page.getByText("Матеріал збережено")).toBeVisible();

  await login(page, "e2e_student");
  await page.goto("/learn/pkg-example-cell-structure");
  await expect(page.getByText("Матеріал готується")).toBeVisible();
  await expect(page.getByText("Оновлений конспект імпортованого прикладу")).toHaveCount(0);

  await login(page, "owner");
  await page.goto("/admin/lessons/pkg-example-cell-structure");
  await page.getByRole("button", { name: "Опублікувати для учнів" }).click();
  await expect(page.getByRole("status")).toContainText("Урок не готовий до публікації:");
  await expect(page.getByRole("status")).toContainText("перевірена практика 4/5/3");

  await login(page, "e2e_student");
  await page.goto("/learn/pkg-example-cell-structure");
  await expect(page.getByText("Матеріал готується")).toBeVisible();
  await expect(page.getByText("Оновлений конспект імпортованого прикладу")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Відео", exact: true })).toHaveCount(0);
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
});
