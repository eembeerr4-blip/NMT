import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill("owner");
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3000\/?$/);
});

test("урок містить конспект і не завершується без практики", async ({ page }) => {
  await page.goto("/learn/math-linear-eq");
  await expect(page.getByRole("heading", { name: "Лінійні рівняння" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Конспект" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Домашнє завдання" })).toBeVisible();
  await page.getByRole("button", { name: "Завершити урок" }).click();
  await expect(page.getByText("Спочатку завершіть домашнє завдання")).toBeVisible();
});

test("відкриває предмет і тему без вигаданого відео", async ({ page }) => {
  await page.goto("/subjects/math");
  await expect(page.getByRole("heading", { name: "Математика" })).toBeVisible();
  await page.locator("a[href='/topics/math-linear-eq']").click();
  await expect(page.getByRole("heading", { name: "Лінійні рівняння" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Відео ще не додано" })).toBeVisible();
});

test("додає YouTube-відео і зберігає його після перезавантаження", async ({ page }) => {
  await page.goto("/topics/math-linear-eq");
  await page.getByPlaceholder("Посилання YouTube").fill("https://www.youtube.com/watch?v=abcdefghijk");
  await page.getByPlaceholder("Назва для себе").fill("Моя лекція");
  await page.getByRole("button", { name: "Додати відео" }).click();
  await expect(page.getByRole("button", { name: "Запустити лекцію" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Моя лекція", { exact: true })).toBeVisible();
});

test("проходить тематичний тест і зберігає результат", async ({ page }) => {
  await page.goto("/topics/math-linear-eq");
  await page.getByRole("button", { name: "Пройти тест" }).click();
  await expect(page.getByText("Завдання 1 з")).toBeVisible();
  for (let index = 0; index < 12; index += 1) {
    const radio = page.locator("input[type=radio]").first();
    const numeric = page.getByPlaceholder("Число");
    const text = page.getByPlaceholder("Коротка відповідь");
    const finalAnswer = page.getByPlaceholder("Кінцева відповідь");
    if (await radio.count()) await radio.check();
    else if (await numeric.count()) await numeric.fill("4");
    else if (await text.count()) await text.fill("4");
    else if (await finalAnswer.count()) await finalAnswer.fill("4");
    if (index < 11) await page.getByRole("button", { name: "Далі" }).click();
  }
  await page.getByRole("button", { name: "Завершити" }).click();
  await expect(page.getByRole("heading", { name: "Результат" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Результат" })).toBeVisible();
});

test("додає результат пробника і показує його в аналітиці", async ({ page }) => {
  await page.goto("/results#add");
  await page.locator("input[name='title'], input[placeholder]").first();
  await page.getByLabel("Дата").fill("2026-10-17");
  await page.getByLabel("Назва або джерело пробника").fill("Пробник Playwright");
  await page.getByLabel("Рейтинговий бал, якщо відомий").fill("151");
  await page.getByText("Враховувати в середньому рейтинговому балі").click();
  await page.getByRole("button", { name: "Зберегти результат" }).click();
  await expect(page.getByText("Пробник Playwright")).toBeVisible();
  await page.goto("/analytics");
  await expect(page.getByText("Математика: 141.5")).toBeVisible();
});

test("переносить заняття в календарі", async ({ page }) => {
  await page.goto("/calendar?view=day&date=2026-10-19");
  const move = page.getByRole("button", { name: "Перенести" }).first();
  const title = (await move.locator("xpath=ancestor::div[contains(@class,'border-t')][1]").locator(".text-sm.font-medium").innerText()).trim();
  await move.locator("xpath=ancestor::form[1]").locator("input[type=date]").evaluate((element) => {
    (element as HTMLInputElement).value = "2026-10-20";
  });
  await move.click();
  await expect(page.getByText("Перенесено").first()).toBeVisible();
  await page.goto("/calendar?view=day&date=2026-10-20");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("створює резервну копію", async ({ page }) => {
  const response = await page.request.get("/api/export/backup");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.version).toBe(1);
  expect(body.examResults.length).toBeGreaterThan(0);
});

test("AI-сторінка працює без ключа", async ({ page }) => {
  await page.goto("/ai-tutor");
  await expect(page.getByText("Провайдер не вибрано")).toBeVisible();
  await page.getByPlaceholder("Що пояснити").fill("Поясни лінійне рівняння");
  await page.getByRole("button", { name: "Запитати" }).click();
  await expect(page.getByText("AI-репетитор вимкнено")).toBeVisible();
});

test("усі основні маршрути відкриваються", async ({ page }) => {
  for (const path of ["/", "/subjects", "/subjects/math", "/subjects/ukrainian", "/subjects/history", "/subjects/biology", "/topics/math-linear-eq", "/tests", "/tests?view=bank", "/exams", "/results", "/analytics", "/analytics?range=week", "/analytics?range=month", "/calendar", "/mistakes", "/review", "/notes", "/ai-tutor", "/settings"]) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBeTruthy();
    await expect(page.getByRole("heading").first()).toBeVisible();
  }
});

test("редагує тему і створює підтему", async ({ page }) => {
  await page.goto("/topics/math-numbers");
  await page.locator("input[name='title']").first().fill("Числа, відсотки та пропорції");
  await page.getByRole("button", { name: "Зберегти тему" }).click();
  await expect(page.getByText("Тему оновлено.")).toBeVisible();
  await page.getByPlaceholder("Нова підтема").fill("Аудит підтема");
  await page.getByRole("button", { name: "Додати підтему" }).click();
  await expect(page.getByText("Підтему створено.")).toBeVisible();
});

test("неправильна відповідь потрапляє в журнал помилок", async ({ page }) => {
  await page.goto("/topics/ukr-ortho");
  await page.getByRole("button", { name: "Пройти тест" }).click();
  for (let index = 0; index < 12; index += 1) {
    const radios = page.locator("input[type=radio]");
    if (await radios.count()) await radios.nth(1).check();
    const text = page.getByPlaceholder("Коротка відповідь");
    if (await text.count()) await text.fill("неправильно");
    if (index < 11) await page.getByRole("button", { name: "Далі" }).click();
  }
  await page.getByRole("button", { name: "Завершити" }).click();
  await expect(page.getByRole("heading", { name: "Результат" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Результат" })).toBeVisible();
  await page.goto("/mistakes");
  await expect(page.getByRole("link", { name: /Орфографія/ }).first()).toBeVisible();
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Найближчі" })).toBeVisible();
});

test("перемикає темну тему", async ({ page }) => {
  await page.goto("/");
  const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await page.getByRole("button", { name: "Змінити тему" }).click();
  await expect.poll(async () => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(!before);
});

test("новий профіль не бачить історичні результати власника", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Розпочати" }).click();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("button", { name: "Географія" }).click();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByPlaceholder("Ім'я").fill("Новий");
  await page.getByPlaceholder("Нікнейм").fill("novyi");
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Створити план" }).click();
  await expect(page.getByRole("heading", { name: /Новий/ })).toBeVisible();
  await page.goto("/results");
  await expect(page.getByText("Недостатньо даних").or(page.getByText("Журнал результатів"))).toBeVisible();
  await expect(page.getByText("132")).toHaveCount(0);
});

test("мобільна навігація не створює горизонтальний скрол", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Мобільна навігація" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBeFalsy();
});
