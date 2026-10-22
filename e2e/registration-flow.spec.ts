import { expect, test, type Page } from "@playwright/test";
import { issueVerifyEmailToken } from "./helpers/issue-verify-token";
import { pendingUserByNickname } from "./helpers/e2e-db";

const password = "test-pass-2027";

async function login(page: Page, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("Нікнейм або email").fill(nickname);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: "Увійти" }).click();
  if (nickname === "owner") {
    await expect(page.getByRole("heading", { name: /Привіт/ })).toBeVisible({ timeout: 15_000 });
  }
}

async function completeOnboarding(page: Page) {
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Розпочати" }).click();
  await page.getByRole("heading", { name: "Профіль" }).waitFor();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("heading", { name: "Предмети" }).waitFor();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("heading", { name: "Навчальне навантаження" }).waitFor();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("button", { name: "Створити план" }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Привіт/ })).toBeVisible({ timeout: 15_000 });
}

test("реєстрація → підтвердження email (e2e) → PENDING → схвалення → onboarding (320px) → пропуск діагностики", async ({ page }) => {
  test.setTimeout(240_000);
  const suffix = `${Date.now().toString(36)}`;
  const nickname = `e2e_reg_${suffix}`;
  const email = `e2e-reg-${suffix}@example.test`;

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/register");
  await page.getByLabel("Нікнейм", { exact: false }).fill(nickname);
  await page.getByLabel("Електронна пошта").fill(email);
  await page.locator("#register-password").fill(password);
  await page.locator("#register-confirm").fill(password);
  await page.getByRole("button", { name: "Зареєструватися" }).click();
  await expect(page.getByRole("heading", { name: "Перевірте пошту" })).toBeVisible({ timeout: 15_000 });

  const token = await issueVerifyEmailToken(nickname);
  await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
  await page.getByRole("button", { name: "Підтвердити email" }).click();
  await expect(page.getByRole("heading", { name: "Електронну пошту підтверджено!" })).toBeVisible();

  await login(page, nickname);
  await expect(page).toHaveURL(/\/pending$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Вийти" }).click();

  const pending = await pendingUserByNickname(nickname);
  expect(pending?.accountStatus).toBe("PENDING");
  expect(pending?.emailVerifiedAt).not.toBeNull();

  await login(page, "owner");
  await page.goto("/admin/moderation");
  const card = page.locator("div.flex.flex-col.gap-3").filter({ hasText: `@${nickname}` });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "Схвалити" }).click();
  await expect(page.getByRole("status").filter({ hasText: /схвалено/i })).toBeVisible();
  await page.getByRole("button", { name: "Вийти" }).click();

  await login(page, nickname);
  await completeOnboarding(page);

  const diagnostic = page.locator("details.d01-diagnostic");
  if (await diagnostic.count()) {
    await diagnostic.locator("summary").click();
    await page.getByRole("button", { name: "Пропустити", exact: true }).click();
    await expect(page.getByText("Можна почати навчання без діагностики.")).toBeVisible();
  }

  await page.goto("/subjects");
  await expect(page.getByRole("heading", { name: "Математика" })).toBeVisible();
});

test("після onboarding учень може розпочати діагностику", async ({ page }) => {
  test.setTimeout(240_000);
  const suffix = `diag_${Date.now().toString(36)}`;
  const nickname = `e2e_diag_${suffix}`;
  const email = `e2e-diag-${suffix}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Нікнейм", { exact: false }).fill(nickname);
  await page.getByLabel("Електронна пошта").fill(email);
  await page.locator("#register-password").fill(password);
  await page.locator("#register-confirm").fill(password);
  await page.getByRole("button", { name: "Зареєструватися" }).click();
  await expect(page.getByRole("heading", { name: "Перевірте пошту" })).toBeVisible({ timeout: 15_000 });

  const token = await issueVerifyEmailToken(nickname);
  await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
  await page.getByRole("button", { name: "Підтвердити email" }).click();

  await login(page, nickname);
  await expect(page).toHaveURL(/\/pending$/);
  await page.getByRole("button", { name: "Вийти" }).click();

  expect((await pendingUserByNickname(nickname))?.accountStatus).toBe("PENDING");

  await login(page, "owner");
  await page.goto("/admin/moderation");
  const card = page.locator("div.flex.flex-col.gap-3").filter({ hasText: `@${nickname}` });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "Схвалити" }).click();
  await page.getByRole("button", { name: "Вийти" }).click();

  await login(page, nickname);
  await completeOnboarding(page);

  const diagnostic = page.locator("details.d01-diagnostic");
  await expect(diagnostic).toBeVisible();
  await diagnostic.locator("summary").click();
  await page.getByRole("button", { name: "Пройти діагностику" }).click();
  await expect(page).toHaveURL(/\/tests\/[^/]+$/, { timeout: 20_000 });
  await expect(page.locator(".d05-eyebrow")).toBeVisible();
});
