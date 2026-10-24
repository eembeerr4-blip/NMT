import { expect, test, type Page } from "@playwright/test";

async function answerCurrentQuestion(page: Page, preferWrong = false) {
  const radio = page.locator("input[type=radio]");
  if (await radio.count()) {
    await (preferWrong && (await radio.count()) > 1 ? radio.nth(1) : radio.first()).check();
    return;
  }
  const stepWork = page.getByPlaceholder("Хід розв'язання");
  const stepFinal = page.getByPlaceholder("Кінцева відповідь");
  if (await stepFinal.count()) {
    if (await stepWork.count()) await stepWork.fill("e2e");
    await stepFinal.fill(preferWrong ? "0" : "4");
    return;
  }
  const numeric = page.getByPlaceholder("Число");
  if (await numeric.count()) {
    await numeric.fill(preferWrong ? "0" : "4");
    return;
  }
  const text = page.getByPlaceholder("Коротка відповідь");
  if (await text.count()) {
    await text.fill(preferWrong ? "неправильно" : "4");
    return;
  }
}

async function runTopicPractice(page: Page, preferWrong = false) {
  await page.getByRole("button", { name: "Пройти тест" }).click();
  await expect(page).toHaveURL(/\/tests\/[^/]+$/);
  const total = Number((await page.locator(".d05-eyebrow").textContent())?.match(/з (\d+)/)?.[1] ?? 12);
  for (let index = 0; index < total; index += 1) {
    await answerCurrentQuestion(page, preferWrong);
    if (index < total - 1) await page.getByRole("button", { name: "Далі" }).click();
  }
  await page.getByRole("button", { name: "Завершити" }).click();
  await page.getByRole("button", { name: "Так, завершити тест" }).click();
  await expect(page.getByRole("heading", { name: "Результат", level: 1 })).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill("owner");
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page.getByRole("heading", { name: /Привіт/ })).toBeVisible({ timeout: 15_000 });
});

test("урок містить конспект і не завершується без практики", async ({ page }) => {
  await page.goto("/learn/math-linear-eq");
  await expect(page.getByRole("heading", { name: "Лінійні рівняння", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: "Конспект" }).click();
  await expect(page.getByRole("heading", { name: "Навчальний конспект" })).toBeVisible();
  await page.getByRole("tab", { name: "Практика" }).click();
  await expect(page.getByRole("heading", { name: "Перевірте розуміння теми" })).toBeVisible();
  await page.getByRole("button", { name: "Завершити урок" }).click();
  await expect(page.getByText("Спочатку завершіть домашнє завдання")).toBeVisible();
});

test("відкриває предмет і тему без вигаданого відео", async ({ page }) => {
  await page.goto("/subjects/math");
  await expect(page.getByRole("heading", { name: "Математика" })).toBeVisible();
  await page.locator("a[href='/topics/math-linear-eq']").click();
  await expect(page.getByRole("heading", { name: "Лінійні рівняння", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Відкрити урок" }).click();
  await expect(page.getByRole("heading", { name: "Відео ще не додано", level: 2 })).toBeVisible();
});

test("додає YouTube-відео і зберігає його після перезавантаження", async ({ page }) => {
  await page.goto("/editor/lessons/math-linear-eq");
  await page.getByText("Інструменти редактора відео").click();
  await page.getByPlaceholder("Посилання YouTube").fill("https://www.youtube.com/watch?v=abcdefghijk");
  await page.getByPlaceholder("Назва для себе").fill("Моя лекція");
  await page.getByRole("button", { name: "Додати відео" }).click();
  await expect(page.getByRole("button", { name: "Запустити лекцію" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Моя лекція", { exact: true }).first()).toBeVisible();
});

test("проходить тематичний тест і зберігає результат", async ({ page }) => {
  await page.goto("/learn/math-linear-eq");
  await page.getByRole("tab", { name: "Практика" }).click();
  await runTopicPractice(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Результат", level: 1 })).toBeVisible();
});

test("додає результат пробника і показує його в аналітиці", async ({ page }) => {
  await page.goto("/results?add=1");
  await page.locator("input[name='title'], input[placeholder]").first();
  await page.getByLabel("Дата").fill("2026-10-17");
  await page.getByLabel("Назва пробника").fill("Пробник Playwright");
  await page.getByLabel("Рейтинговий бал (100–200)").fill("151");
  await page.getByText("Додаткові параметри").click();
  await page.getByText("Враховувати в середньому рейтинговому балі").click();
  await page.getByRole("button", { name: "Зберегти результат" }).click();
  await expect(page.getByText("Пробник Playwright")).toBeVisible();
  await page.goto("/analytics");
  const mathCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "Математика", level: 2 }) });
  await expect(mathCard.getByText("151", { exact: true })).toBeVisible();
});

test("переносить заняття в календарі", async ({ page }) => {
  await page.goto("/calendar?view=day&date=2026-10-19");
  const title = "E2E перенос заняття";
  const taskRow = page.locator("div.rounded-xl.border").filter({ has: page.getByText(title, { exact: true }) });
  await expect(taskRow).toBeVisible();
  await taskRow.locator("details summary").click();
  const moveForm = taskRow.locator("form").filter({ has: page.getByRole("button", { name: "Перенести" }) });
  await expect(moveForm).toBeVisible();
  await moveForm.getByLabel("Нова дата").fill("2026-10-20");
  await moveForm.getByRole("button", { name: "Перенести" }).click();
  await expect(page.getByText("Перенесено").first()).toBeVisible();
  await page.goto("/calendar?view=day&date=2026-10-20");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("створює резервну копію", async ({ page }) => {
  const response = await page.request.get("/api/export/backup");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.version).toBe(5);
  expect(body.examResults.length).toBeGreaterThan(0);
});

test("усі основні маршрути відкриваються", async ({ page }) => {
  for (const path of ["/", "/subjects", "/subjects/math", "/subjects/ukrainian", "/subjects/history", "/subjects/biology", "/topics/math-linear-eq", "/tests", "/tests?view=bank", "/exams", "/results", "/analytics", "/analytics?range=week", "/analytics?range=month", "/calendar", "/mistakes", "/review", "/settings"]) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBeTruthy();
    await expect(page.getByRole("heading").first()).toBeVisible();
  }
});

test("редагує тему і створює підтему", async ({ page }) => {
  await page.goto("/admin/topics/math-numbers");
  await page.locator("input[name='title']").first().fill("Числа, відсотки та пропорції");
  await page.getByRole("button", { name: "Зберегти тему" }).click();
  await expect(page.getByText("Тему оновлено.")).toBeVisible();
  await page.getByPlaceholder("Нова підтема").fill("Аудит підтема");
  await page.getByRole("button", { name: "Додати підтему" }).click();
  await expect(page.getByText("Підтему створено.")).toBeVisible();
});

test("неправильна відповідь потрапляє в журнал помилок", async ({ page }) => {
  await page.goto("/learn/ukr-ortho");
  await page.getByRole("tab", { name: "Практика" }).click();
  await runTopicPractice(page, true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Результат", level: 1 })).toBeVisible();
  await page.goto("/mistakes");
  await expect(page.getByRole("heading", { name: "Орфографія", level: 2 }).first()).toBeVisible();
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
  await page.goto("/admin");
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await page.getByPlaceholder("Нікнейм").fill("e2e_student");
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page.getByRole("heading", { name: /Привіт, E2E/ })).toBeVisible({ timeout: 15_000 });
  await page.goto("/results");
  await expect(page.getByText("Недостатньо даних").or(page.getByText("Журнал результатів"))).toBeVisible();
  await expect(page.getByText("132")).toHaveCount(0);
});

test("адміністратор e2e_admin зберігає налаштування платформи", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await page.getByPlaceholder("Нікнейм").fill("e2e_admin");
  await page.locator("input[type=password]").fill("test-pass-2027");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page.getByRole("heading", { name: /Привіт, E2E-Admin/ })).toBeVisible({ timeout: 15_000 });
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Налаштування платформи" })).toBeVisible();
  await page.getByText("Додаткові параметри навчання").click();
  await page.getByRole("button", { name: "Зберегти JSON" }).first().click();
  await expect(page.getByText("Збережено.").or(page.getByText("Конфігурацію"))).toBeVisible();
});

test("мобільна навігація не створює горизонтальний скрол", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Відкрити меню" }).click();
  await expect(page.getByRole("navigation", { name: "Мобільна навігація" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBeFalsy();
});
