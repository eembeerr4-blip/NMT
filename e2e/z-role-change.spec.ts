import { expect, test } from "@playwright/test";
import { userRole } from "./helpers/e2e-db";

const TARGET_ID = "e2e_student_b";
const TARGET_NICK = "e2e_student_b";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill("owner");
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page.getByRole("heading", { name: /Привіт/ })).toBeVisible({ timeout: 15_000 });
});

test("власник призначає ADMIN через інтерфейс, БД і вхід нового адміністратора", async ({ page }) => {
  expect(await userRole(TARGET_ID)).toBe("STUDENT");

  await page.goto(`/admin/users?q=${TARGET_NICK}`);
  const row = page.locator("table").getByRole("row", { name: new RegExp(TARGET_NICK, "i") });
  const roleSelect = row.getByLabel(new RegExp(`Нова роль профілю ${TARGET_NICK}`, "i"));
  await roleSelect.selectOption({ label: "Адміністратор" });
  await row.getByRole("button", { name: "Змінити роль" }).click();
  await page.getByRole("button", { name: "Підтвердити зміну" }).click();

  await expect.poll(async () => userRole(TARGET_ID), { timeout: 20_000 }).toBe("ADMIN");

  await page.reload();
  await expect(roleSelect).toHaveValue("ADMIN");

  await page.goto("/admin");
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

  await page.getByPlaceholder("Нікнейм").fill(TARGET_NICK);
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page.getByRole("heading", { name: /Привіт, E2E-B/ })).toBeVisible({ timeout: 15_000 });

  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Налаштування платформи" })).toBeVisible();
  await page.getByText("Додаткові параметри навчання").click();
  await page.getByRole("button", { name: "Зберегти JSON" }).first().click();
  await expect(page.getByText("Збережено.").or(page.getByText("Конфігурацію"))).toBeVisible();
});
