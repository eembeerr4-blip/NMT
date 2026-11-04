import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
const fixture = JSON.parse(readFileSync(process.env.STAGE82_BALANCED_LOCATION!, "utf8"));
const folder = realpathSync(fixture.folder);
if (!fixture.synthetic || path.dirname(folder) !== path.resolve(tmpdir()) || !path.basename(folder).startsWith("nmt-stage82-balanced-") || path.resolve(fixture.database) !== path.join(folder, "qa.db")) throw Error("Refusing non-fixture database");
const db = new PrismaClient({ datasourceUrl: "file:" + fixture.database.replaceAll("\\", "/") + "?connection_limit=1" });
const artifacts = process.env.STAGE82_BALANCED_ARTIFACTS!;
mkdirSync(artifacts, { recursive: true });
const steps: { name: string; status: string; detail?: unknown }[] = [];
const responses: { route: string; status: number }[] = [];
async function login(page: Page, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("Нікнейм або email", { exact: true }).fill(nickname);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function setCard(page: Page, purpose: string) {
  await page.goto("/tests");
  return page.locator(".d05-available-card").filter({ hasText: purpose === "FINAL" ? "Підсумкова перевірка" : "Відкладена перевірка" });
}
async function answer(page: Page, q: { id: string; type: string; correctAnswer: string; options: { id: string; label: string; matchKey: string | null }[] }, wrong = false) {
  if (q.type === "SINGLE_CHOICE") {
    const option = q.options.findIndex(o => wrong ? o.id !== q.correctAnswer : o.id === q.correctAnswer);
    await page.locator('input[type="radio"]').nth(option).check();
  } else if (q.type === "MATCHING") {
    const values = JSON.parse(q.correctAnswer);
    const left = q.options.filter(o => o.matchKey === "left"), right = q.options.filter(o => o.matchKey === "right");
    for (let i = 0; i < left.length; i++) {
      const value = values[left[i].id] ?? values[left[i].label];
      const target = right.find(o => o.id === value || o.label === value)!;
      await page.locator("select").nth(i).selectOption(target.id);
    }
  } else await page.getByLabel("Числова відповідь", { exact: true }).fill(wrong ? "999" : q.correctAnswer.replace(".", ","));
}
async function takeAttempt(page: Page, wrongCount: number, reloadFirst = false) {
  await expect(page).toHaveURL(/\/tests\/[^/]+$/);
  const id = page.url().split("/").pop()!;
  const attempt = await db.testAttempt.findUniqueOrThrow({ where: { id }, include: { test: { include: { questions: { orderBy: { sortOrder: "asc" }, include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } } } } } } });
  let wrongLeft = wrongCount;
  for (let i = 0; i < attempt.test.questions.length; i++) {
    const q = attempt.test.questions[i].question;
    const wrong = wrongLeft > 0 && q.type === "NUMERIC";
    if (wrong) wrongLeft--;
    await expect(page.getByText(`Завдання ${i + 1} з ${attempt.test.questions.length}`, { exact: true })).toBeVisible();
    await answer(page, q, wrong);
    if (i === 0 && reloadFirst) {
      await expect.poll(async () => JSON.parse((await db.testAttempt.findUniqueOrThrow({ where: { id } })).draftJson)[q.id], { timeout: 15000 }).not.toBeUndefined();
      await page.reload();
      if (q.type === "NUMERIC") await expect(page.getByLabel("Числова відповідь", { exact: true })).toHaveValue(wrong ? "999" : q.correctAnswer.replace(".", ","));
    }
    if (i < attempt.test.questions.length - 1) await page.getByRole("button", { name: "Далі", exact: true }).click();
  }
  expect(wrongLeft).toBe(0);
  await page.getByRole("button", { name: "Завершити", exact: true }).click();
  await page.getByRole("button", { name: "Так, завершити тест", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Результат", exact: true })).toBeVisible();
  const saved = await db.testAttempt.findUniqueOrThrow({ where: { id } });
  expect(saved.status).toBe("COMPLETED"); expect(saved.correctCount).toBe(attempt.test.questions.length - wrongCount);
  return { id, test: attempt.test, saved };
}

test("real balanced algebra pilot: approval, practice, independent controls, persistence and permissions", async ({ page, browser }) => {
  let status = "BLOCKED";
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.request().method() === "POST") responses.push({ route: new URL(response.url()).pathname, status: response.status() }); });
  try {
    await login(page, "s82_student"); steps.push({ name: "01 approved STUDENT login", status: "PASS" });
    const controls = await db.question.findMany({ where: { id: { startsWith: "s81-expressions-" } }, select: { id: true } });
    await page.goto("/tests");
    const catalogue = await page.content();
    for (const q of controls) expect(catalogue).not.toContain(q.id);
    const earlyCard = await setCard(page, "DELAYED"); await earlyCard.getByRole("button", { name: "Розпочати тест" }).click();
    await expect(earlyCard.getByRole("alert")).toContainText("7 повних діб");
    expect(await db.testAttempt.count({ where: { userId: "s82_student", testId: fixture.sets.DELAYED } })).toBe(0);
    steps.push({ name: "control contents hidden before admission", status: "PASS" });
    await page.goto("/learn/math-expressions");
    await expect(page.getByRole("heading", { name: "Алгебраїчні вирази", exact: true })).toBeVisible();
    await expect(page.getByRole("tabpanel").filter({ visible: true })).toContainText("ОДЗ");
    await page.screenshot({ path: path.join(artifacts, "lesson-desktop.png"), fullPage: true, caret: "initial" });
    steps.push({ name: "02 lesson; 03 rendered theory", status: "PASS" });
    await page.getByRole("tab", { name: "Приклади", exact: true }).click();
    await page.getByRole("button", { name: "Переглянути розв'язання", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Розв’язання", exact: true }).first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(artifacts, "examples-mobile.png"), fullPage: true, caret: "initial" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("tab", { name: "Практика", exact: true }).click();
    await page.getByRole("button", { name: "Пройти тест", exact: true }).click();
    await expect(page).toHaveURL(/\/tests\/[^/]+$/);
    const practice = await takeAttempt(page, 1);
    expect(practice.test.questions).toHaveLength(12);
    expect(practice.test.questions.every(row => fixture.practiceIds.includes(row.questionId))).toBe(true);
    steps.push({ name: "04 real balanced practice, 12 questions, holdout exclusion", status: "PASS", detail: { correct: 11, total: 12 } });
    await page.goto("/learn/math-expressions"); await page.getByRole("tab", { name: "Практика", exact: true }).click();
    await page.getByRole("button", { name: "Завершити урок", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Урок зараховано" })).toBeVisible();
    steps.push({ name: "05 lesson completion", status: "PASS" });
    const finalCard = await setCard(page, "FINAL"); await finalCard.getByRole("button", { name: "Розпочати тест" }).click();
    const final = await takeAttempt(page, 1, true);
    steps.push({ name: "06 final admission; 07 answers; 08 draft/reload and stored results", status: "PASS", detail: { correct: 5, total: 6 } });
    expect((await db.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: "s82_student", topicId: "math-expressions" } } })).status).not.toBe("MASTERED");
    await page.goto("/mistakes"); await expect(page.getByRole("heading", { name: "Мої помилки", exact: true })).toBeVisible();
    const mistake = await db.mistake.findFirstOrThrow({ where: { userId: "s82_student", questionId: final.test.questions[0].questionId }, include: { question: { include: { options: true } } } });
    await page.goto(`/mistakes/${mistake.id}/retry`); await answer(page, mistake.question!);
    await page.getByRole("button", { name: "Перевірити нову відповідь", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Помилку виправлено");
    expect((await db.mistake.findUniqueOrThrow({ where: { id: mistake.id } })).status).toBe("FIXED");
    steps.push({ name: "09 mistakes and genuine correction", status: "PASS" });
    await page.context().clearCookies(); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await login(page, "s82_student"); await page.goto(`/tests/${final.id}`);
    await expect(page.getByRole("heading", { name: "Результат", exact: true })).toBeVisible();
    expect(await db.answer.count({ where: { attemptId: final.id } })).toBe(6);
    steps.push({ name: "10 login again and persisted progress/results", status: "PASS" });
    const repeat = await setCard(page, "FINAL"); await repeat.getByRole("button", { name: "Розпочати тест" }).click();
    await expect(repeat.getByRole("alert")).toContainText("вже розпочато");
    const delayedEarly = await setCard(page, "DELAYED"); await delayedEarly.getByRole("button", { name: "Розпочати тест" }).click();
    await expect(delayedEarly.getByRole("alert")).toContainText("7 повних діб");
    expect(await db.testAttempt.count({ where: { userId: "s82_student", testId: fixture.sets.FINAL } })).toBe(1);
    steps.push({ name: "11 repeat FINAL blocked; 12 premature DELAYED blocked", status: "PASS" });
    const otherContext = await browser.newContext({ baseURL: "http://127.0.0.1:3148" }); const other = await otherContext.newPage();
    await login(other, "s82_other"); const foreign = await other.goto(`/tests/${final.id}`); expect([200, 404]).toContain(foreign?.status()); await expect(other.getByRole("heading", { name: "Сторінку не знайдено", exact: true })).toBeVisible();
    const denied = await other.goto(`/admin/tests/${fixture.sets.FINAL}`); expect([200, 403, 404]).toContain(denied?.status()); await expect(other.getByRole("heading", { name: "Сторінку не знайдено", exact: true })).toBeVisible();
    expect(await other.content()).not.toContain(final.test.questions[0].questionId);
    await otherContext.close();
    const ownerContext = await browser.newContext({ baseURL: "http://127.0.0.1:3148" }); const owner = await ownerContext.newPage(); await login(owner, "owner");
    const allowed = await owner.goto(`/admin/tests/${fixture.sets.FINAL}`); expect(allowed?.status()).toBe(200);
    await expect(owner.getByRole("button", { name: "Архівувати", exact: true })).toBeVisible(); await ownerContext.close();
    steps.push({ name: "foreign results denied; OWNER/STUDENT permissions", status: "PASS" });
    // Controlled historical timestamps in THIS fixture only; no production clock
    // override or user-facing test backdoor is introduced.
    const old = new Date(Date.now() - 7 * 86400000 - 1000);
    await db.testAttempt.update({ where: { id: final.id, userId: "s82_student" }, data: { startedAt: new Date(old.getTime() - 60000), finishedAt: old } });
    const delayedCard = await setCard(page, "DELAYED"); await delayedCard.getByRole("button", { name: "Розпочати тест" }).click();
    const delayed = await takeAttempt(page, 0);
    expect((await db.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: "s82_student", topicId: "math-expressions" } } })).status).toBe("MASTERED");
    await expect(page.locator(".d05-topic-status")).toContainText("засвоєно");
    await page.screenshot({ path: path.join(artifacts, "delayed-mastered-desktop.png"), fullPage: true, caret: "initial" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(artifacts, "delayed-mastered-mobile.png"), fullPage: true, caret: "initial" });
    expect(delayed.test.questions.every(row => !fixture.practiceIds.includes(row.questionId) && !final.test.questions.some(first => first.questionId === row.questionId))).toBe(true);
    steps.push({ name: "13 independent delayed control and MASTERED", status: "PASS", detail: { simulatedTime: true, actualSevenDayWait: false, correct: 6, total: 6 } });
    expect(await db.$queryRawUnsafe("PRAGMA integrity_check")).toEqual([{ integrity_check: "ok" }]);
    expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
    expect(errors).toEqual([]); status = "PASS";
  } finally {
    writeFileSync("content/stage8/validation82/balanced/browser-QA.json", JSON.stringify({ status, steps, actionResponses: responses, browserErrors: errors, actualSevenDayWait: false, clockMethod: "Fixture-owned FINAL recorded timestamps moved back seven days; server time left unchanged", database: "unique temporary SQLite, real pilot and real server actions", productionAccessed: false }, null, 2) + "\n");
    await db.$disconnect();
  }
});
