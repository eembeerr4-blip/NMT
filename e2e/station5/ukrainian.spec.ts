import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
const fixture = JSON.parse(readFileSync(path.join(process.env.STATION5_PRIVATE_ROOT!, 'fixture-location.json'), 'utf8'));
const folder = realpathSync(fixture.folder);
if (!fixture.station5 || !fixture.synthetic || path.dirname(folder) !== path.resolve(tmpdir()) || !path.basename(folder).startsWith('nmt-station5-') || path.resolve(fixture.database) !== path.join(folder, 'qa.db')) throw Error('Refusing non-fixture database');
const db = new PrismaClient({ datasourceUrl: 'file:' + fixture.database.replaceAll('\\', '/') + '?connection_limit=1' });
const artifacts = process.env.STATION5_ARTIFACTS!; mkdirSync(artifacts, { recursive: true });
test.afterAll(async () => { await db.$disconnect(); });
async function login(page: Page, nickname = 's5_student') {
  await page.goto('/login');
  await page.getByLabel('Нікнейм або email', { exact: true }).fill(nickname);
  await page.getByLabel('Пароль', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
test('all candidate lessons render for staff on mobile; STUDENT access follows the real gate', async ({ page, browser }) => {
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const student = await otherContext.newPage(); const checks = []; let status = 'BLOCKED'; const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); student.on('pageerror', e => errors.push(e.message));
  for (const current of [page, student]) current.on('console', message => { if (message.type() === 'error' && message.text().includes('same key')) errors.push(message.text()); });
  try {
    await login(page, 'owner'); await login(student); await page.setViewportSize({ width: 390, height: 844 });
    for (const topic of fixture.candidates) {
      await student.goto(`/learn/${topic.id}`);
      if (!topic.ready) { await expect(student.getByRole('heading', { name: 'Матеріал готується', exact: true })).toBeVisible(); await expect(student.getByRole('tab')).toHaveCount(0); }
      else await expect(student.getByRole('heading', { name: topic.title, exact: true })).toBeVisible();
      await page.goto(`/learn/${topic.id}`);
      await expect(page.getByRole('heading', { name: topic.title, exact: true })).toBeVisible();
      if (!topic.ready) await expect(page.getByRole('status').filter({ hasText: 'Чернетка' })).toBeVisible();
      for (const name of ['Теорія', 'Конспект', 'Приклади']) {
        await page.getByRole('tab', { name, exact: true }).click();
        await expect(page.getByRole('tabpanel').filter({ visible: true })).not.toBeEmpty();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      await expect(page.getByRole('article')).toHaveCount(6);
      await page.getByRole('button', { name: "Переглянути розв'язання", exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Розв’язання', exact: true }).first()).toBeVisible();
      await page.getByRole('tab', { name: 'Конспект', exact: true }).click();
      await page.screenshot({ path: path.join(artifacts, `${topic.id}-mobile.png`), fullPage: true });
      checks.push({ id: topic.id, staffTheoryNotesSixExamples: 'PASS', mobileOverflow: false, studentAvailable: topic.ready, gateBypassed: false });
    }
    expect(await db.testAttempt.count()).toBe(0); expect(errors).toEqual([]); status = 'PASS';
  } finally {
    await otherContext.close();
    writeFileSync('content/station5/candidate-browser-QA.json', JSON.stringify({ status, checks, browserErrors: errors, productionAccessed: false, studentCycleForDrafts: 'BLOCKED by unchanged gate, not claimed PASS' }, null, 2) + '\n');
  }
});
async function takeAttempt(page: Page, makeMistake = false, reloadFirst = false) {
  await expect(page).toHaveURL(/\/tests\/[^/]+$/); const id = page.url().split('/').pop()!;
  const attempt = await db.testAttempt.findUniqueOrThrow({ where: { id }, include: { test: { include: { questions: { orderBy: { sortOrder: 'asc' }, include: { question: { include: { options: true } } } } } } } });
  let wrongId: string | null = null;
  for (let i = 0; i < attempt.test.questions.length; i++) {
    const q = attempt.test.questions[i].question;
    await expect(page.getByText(`Завдання ${i + 1} з ${attempt.test.questions.length}`, { exact: true })).toBeVisible();
    expect(await page.content()).not.toContain('"correctAnswer"');
    if (q.type === 'SINGLE_CHOICE') {
      const wrong = makeMistake && wrongId === null;
      const option = q.options.find(o => wrong ? o.id !== q.correctAnswer : o.id === q.correctAnswer)!;
      await page.locator('label').filter({ hasText: option.label + '.' }).filter({ has: page.getByRole('radio') }).click();
      if (wrong) wrongId = q.id;
    } else if (q.type === 'MATCHING') {
      for (const [left, right] of Object.entries(JSON.parse(q.correctAnswer))) await page.locator(`[id="matching-${q.id}-${left}"]`).selectOption(String(right));
    } else await page.getByLabel('Коротка відповідь', { exact: true }).fill(q.correctAnswer.split('|')[0]);
    if (i === 0 && reloadFirst) {
      await expect.poll(async () => JSON.parse((await db.testAttempt.findUniqueOrThrow({ where: { id } })).draftJson)[q.id]).not.toBeUndefined();
      await page.reload();
      if (q.type === 'SINGLE_CHOICE') await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
    }
    if (i < attempt.test.questions.length - 1) await page.getByRole('button', { name: 'Далі', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Завершити', exact: true }).click(); await page.getByRole('button', { name: 'Так, завершити тест', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Результат', exact: true })).toBeVisible();
  const result = await db.testAttempt.findUniqueOrThrow({ where: { id } });
  expect(result.correctCount).toBe(attempt.test.questions.length - (makeMistake ? 1 : 0)); expect(result.pendingCount).toBe(0);
  return { id, test: attempt.test, wrongId };
}
async function controlCard(page: Page, purpose: string) { await page.goto('/tests'); return page.locator('.d05-available-card').filter({ hasText: `${purpose} · Station5 QA` }); }
test('existing available lexical lesson completes an actual student cycle with private holdout controls', async ({ page, browser }) => {
  const checks: string[] = []; let status = 'BLOCKED'; const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await login(page); await page.goto('/tests'); const html = await page.content();
    const controls = await db.question.findMany({ where: { source: { startsWith: 'PRIVATE CONTROL' } }, select: { id: true, prompt: true } });
    expect(controls).toHaveLength(12); for (const q of controls) { expect(html).not.toContain(q.prompt); expect(html).not.toContain(q.id); }
    await page.goto(`/learn/${fixture.legacy.id}`); await expect(page.getByRole('heading', { name: fixture.legacy.title, exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Практика', exact: true }).click(); await page.getByRole('button', { name: 'Пройти тест', exact: true }).click();
    const practice = await takeAttempt(page, true, true); expect(practice.test.questions).toHaveLength(12);
    expect(practice.test.questions.every(q => fixture.legacy.practiceIds.includes(q.questionId))).toBe(true); await expect(page.locator('.d05-explanation')).toHaveCount(12);
    checks.push('12-question real legacy practice, one error, SC/matching/legacy short text, draft reload, explanations, private controls excluded');
    const mistake = await db.mistake.findFirstOrThrow({ where: { userId: 's5_student', questionId: practice.wrongId! }, include: { question: { include: { options: true } } } });
    await page.goto(`/mistakes/${mistake.id}/retry`); const option = mistake.question!.options.find(o => o.id === mistake.question!.correctAnswer)!;
    await page.locator('label').filter({ hasText: option.label + '.' }).filter({ has: page.getByRole('radio') }).click();
    await page.getByRole('button', { name: 'Перевірити нову відповідь', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Помилку виправлено');
    expect((await db.mistake.findUniqueOrThrow({ where: { id: mistake.id } })).status).toBe('FIXED');
    await page.goto(`/learn/${fixture.legacy.id}`); await page.getByRole('tab', { name: 'Практика', exact: true }).click(); await page.getByRole('button', { name: 'Завершити урок', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Урок зараховано' })).toBeVisible(); checks.push('mistake correction, lesson completion, saved progress and review schedule');
    const finalCard = await controlCard(page, 'FINAL'); await finalCard.getByRole('button', { name: 'Розпочати тест' }).click(); const final = await takeAttempt(page);
    await page.context().clearCookies(); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await login(page); await page.goto(`/tests/${final.id}`);
    await expect(page.getByRole('heading', { name: 'Результат', exact: true })).toBeVisible(); checks.push('FINAL6/6, relogin and persistence');
    const outsider = await browser.newContext(); const other = await outsider.newPage(); await login(other, 's5_other'); await other.goto(`/tests/${final.id}`);
    await expect(other.getByRole('heading', { name: 'Сторінку не знайдено', exact: true })).toBeVisible(); const otherHtml = await other.content(); for (const q of controls) expect(otherHtml).not.toContain(q.prompt); await outsider.close();
    const early = await controlCard(page, 'DELAYED'); await early.getByRole('button', { name: 'Розпочати тест' }).click(); await expect(early.getByRole('alert')).toContainText('7 повних діб');
    expect(await db.testAttempt.count({ where: { testId: fixture.legacy.sets.DELAYED } })).toBe(0);
    const past = new Date(Date.now() - 7 * 86400000 - 60000); await db.testAttempt.update({ where: { id: final.id }, data: { startedAt: new Date(past.getTime() - 60000), finishedAt: past } });
    const delayed = await controlCard(page, 'DELAYED'); await delayed.getByRole('button', { name: 'Розпочати тест' }).click(); await takeAttempt(page);
    expect((await db.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: 's5_student', topicId: fixture.legacy.id } } })).status).toBe('MASTERED');
    expect(await db.answer.count()).toBe(24); expect(await db.testAttempt.count()).toBe(3); expect(await db.reviewSchedule.count({ where: { userId: 's5_student' } })).toBeGreaterThan(0);
    expect(await db.$queryRawUnsafe('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]); expect(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([]); expect(errors).toEqual([]);
    checks.push('other learner denied, premature DELAYED denied, fixture-only7day simulation, DELAYED6/6 and MASTERED;24answers3attempts; integrity/FK clean'); status = 'PASS';
  } finally { writeFileSync('content/station5/learner-browser-QA.json', JSON.stringify({ status, scope: 'One existing READY lexical lesson; this does not assert new DRAFT candidate availability or full course acceptance', checks, browserErrors: errors, actualSevenDayWait: false, productionAccessed: false, privateControlBankPublished: false }, null, 2) + '\n'); }
});
