import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
const fixture = JSON.parse(readFileSync(process.env.STATION4_QA_LOCATION!, 'utf8'));
const folder = realpathSync(fixture.folder);
if (!fixture.station4 || !fixture.synthetic || path.dirname(folder) !== path.resolve(tmpdir()) || !path.basename(folder).startsWith('nmt-station4-') || path.resolve(fixture.database) !== path.join(folder, 'qa.db')) throw Error('Refusing non-fixture database');
const db = new PrismaClient({ datasourceUrl: 'file:' + fixture.database.replaceAll('\\', '/') + '?connection_limit=1' });
const artifacts = process.env.STATION4_ARTIFACTS!;
mkdirSync(artifacts, { recursive: true });
const steps: { module: string; check: string; status: string }[] = [];
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Нікнейм або email', { exact: true }).fill('s4_student');
  await page.getByLabel('Пароль', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function takeAttempt(page: Page, wrongCount: number, reloadFirst = false) {
  await expect(page).toHaveURL(/\/tests\/[^/]+$/);
  const id = page.url().split('/').pop()!;
  const attempt = await db.testAttempt.findUniqueOrThrow({ where: { id }, include: { test: { include: { questions: { orderBy: { sortOrder: 'asc' }, include: { question: { include: { options: true } } } } } } } });
  for (let i = 0; i < attempt.test.questions.length; i++) {
    const q = attempt.test.questions[i].question;
    await expect(page.getByText(`Завдання ${i + 1} з ${attempt.test.questions.length}`, { exact: true })).toBeVisible();
    const answer = q.type === 'SINGLE_CHOICE'
      ? (i < wrongCount ? q.options.find(o => o.id !== q.correctAnswer)!.id : q.correctAnswer)
      : (i < wrongCount ? '999999' : q.correctAnswer.replace('.', ','));
    if (q.type === 'SINGLE_CHOICE') {
      const option = q.options.find(o => o.id === answer)!;
      await page.locator('label').filter({ hasText: option.label + '.' }).filter({ has: page.getByRole('radio') }).click();
    } else await page.getByLabel('Числова відповідь', { exact: true }).fill(answer);
    if (i === 0 && reloadFirst) {
      await expect.poll(async () => JSON.parse((await db.testAttempt.findUniqueOrThrow({ where: { id } })).draftJson)[q.id]).not.toBeUndefined();
      await page.reload();
      if (q.type === 'SINGLE_CHOICE') await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
      else await expect(page.getByLabel('Числова відповідь', { exact: true })).toHaveValue(answer);
    }
    if (i < attempt.test.questions.length - 1) await page.getByRole('button', { name: 'Далі', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Завершити', exact: true }).click();
  await page.getByRole('button', { name: 'Так, завершити тест', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Результат', exact: true })).toBeVisible();
  const result = await db.testAttempt.findUniqueOrThrow({ where: { id } });
  expect(result.status).toBe('COMPLETED');
  expect(result.correctCount).toBe(attempt.test.questions.length - wrongCount);
  return { id, test: attempt.test };
}
async function card(page: Page, title: string, purpose: string) {
  await page.goto('/tests');
  return page.locator('.d05-available-card').filter({ hasText: `${purpose === 'FINAL' ? 'Підсумкова перевірка' : 'Відкладена перевірка'} · ${title}` });
}
test('three real foundation modules: mobile learning, mistakes, persistence and independent delayed checks', async ({ page }) => {
  test.skip(fixture.draftOnly, 'Final reviewed bank lacks genuine HARD questions; preserve the publication gate.');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  let status = 'BLOCKED';
  try {
    await login(page);
    await page.goto('/tests');
    const catalogue = await page.content();
    const controls = await db.question.findMany({ where: { source: { startsWith: 'PRIVATE CONTROL' } }, select: { id: true, prompt: true } });
    expect(controls).toHaveLength(36);
    for (const q of controls) { expect(catalogue).not.toContain(q.id); expect(catalogue).not.toContain(q.prompt); }
    steps.push({ module: 'all', check: '36 closed control prompts and IDs absent from student catalogue', status: 'PASS' });
    for (const topic of fixture.topics) {
      const record = (check: string) => steps.push({ module: topic.id, check, status: 'PASS' });
      await page.goto(`/learn/${topic.id}`);
      await expect(page.getByRole('heading', { name: topic.title, exact: true })).toBeVisible();
      const panel = page.getByRole('tabpanel').filter({ visible: true });
      await expect(panel).not.toBeEmpty(); record('lesson and full theory');
      await page.setViewportSize({ width: 390, height: 844 });
      for (const tab of ['Теорія', 'Приклади', 'Конспект']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await expect(panel).not.toBeEmpty();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      await page.screenshot({ path: path.join(artifacts, `${topic.id}-notes-mobile.png`), fullPage: true, caret: 'initial' });
      await page.getByRole('tab', { name: 'Приклади', exact: true }).click();
      const lesson = JSON.parse((await db.topic.findUniqueOrThrow({ where: { id: topic.id } })).lessonJson) as { examples: { answerCheck?: { value: number } }[] };
      const exampleIndex = lesson.examples.findIndex(e => e.answerCheck);
      expect(exampleIndex).toBeGreaterThanOrEqual(0);
      const example = page.getByRole('article', { name: `Приклад ${exampleIndex + 1}`, exact: true });
      await example.getByLabel('Ваша відповідь', { exact: true }).fill('999999');
      await example.getByRole('button', { name: 'Перевірити відповідь', exact: true }).click();
      await expect(example.getByRole('status')).toContainText('Неправильно');
      await example.getByLabel('Ваша відповідь', { exact: true }).fill(String(lesson.examples[exampleIndex].answerCheck!.value).replace('.', ','));
      await example.getByRole('button', { name: 'Перевірити відповідь', exact: true }).click();
      await expect(example.getByRole('status')).toContainText('Правильно');
      await page.getByRole('button', { name: "Переглянути розв'язання", exact: true }).first().click();
      await expect(page.getByRole('heading', { name: 'Розв’язання', exact: true }).first()).toBeVisible();
      record('mobile theory/examples/notes without overflow; wrong and correct example answers; actual solution revealed');
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.getByRole('tab', { name: 'Практика', exact: true }).click();
      await page.getByRole('button', { name: 'Пройти тест', exact: true }).click();
      const practice = await takeAttempt(page, 1, true);
      await expect(page.locator('.d05-explanation')).toHaveCount(12);
      expect(practice.test.questions).toHaveLength(12);
      expect(practice.test.questions.every(q => topic.practiceIds.includes(q.questionId))).toBe(true);
      record('12 real practice answers; deliberate error; saved draft survives reload');
      const mistake = await db.mistake.findFirstOrThrow({ where: { userId: 's4_student', questionId: practice.test.questions[0].questionId }, include: { question: true } });
      await page.goto(`/mistakes/${mistake.id}/retry`);
      await page.getByLabel('Числова відповідь', { exact: true }).fill(mistake.question!.correctAnswer.replace('.', ','));
      await page.getByRole('button', { name: 'Перевірити нову відповідь', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Помилку виправлено');
      expect((await db.mistake.findUniqueOrThrow({ where: { id: mistake.id } })).status).toBe('FIXED');
      record('mistake explanation and correction persisted');
      await page.goto(`/learn/${topic.id}`);
      await page.getByRole('tab', { name: 'Практика', exact: true }).click();
      await page.getByRole('button', { name: 'Завершити урок', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Урок зараховано' })).toBeVisible();
      record('lesson completion persisted');
      const finalCard = await card(page, topic.title, 'FINAL');
      await finalCard.getByRole('button', { name: 'Розпочати тест' }).click();
      const final = await takeAttempt(page, 0);
      record('independent FINAL 6/6');
      await page.context().clearCookies();
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await login(page);
      await page.goto(`/tests/${final.id}`);
      await expect(page.getByRole('heading', { name: 'Результат', exact: true })).toBeVisible();
      expect(await db.answer.count({ where: { attemptId: final.id } })).toBe(6);
      record('login again; saved results and progress');
      const outsider = await page.context().browser()!.newContext();
      const other = await outsider.newPage();
      await other.goto('http://127.0.0.1:3154/login');
      await other.getByLabel('Нікнейм або email', { exact: true }).fill('s4_other');
      await other.getByLabel('Пароль', { exact: true }).fill(fixture.password);
      await other.getByRole('button', { name: 'Увійти', exact: true }).click();
      await expect(other).not.toHaveURL(/\/login/);
      await other.goto('http://127.0.0.1:3154/tests/' + final.id);
      await expect(other.getByRole('heading', { name: 'Сторінку не знайдено', exact: true })).toBeVisible();
      await expect(other.locator('.d05-review-card')).toHaveCount(0);
      const unauthorizedHtml = await other.content();
      for (const q of controls) { expect(unauthorizedHtml).not.toContain(q.prompt); }
      await outsider.close();
      record('other STUDENT sees not-found for private attempt; no review or control prompts exposed');
      const early = await card(page, topic.title, 'DELAYED');
      await early.getByRole('button', { name: 'Розпочати тест' }).click();
      await expect(early.getByRole('alert')).toContainText('7 повних діб');
      expect(await db.testAttempt.count({ where: { userId: 's4_student', testId: topic.sets.DELAYED } })).toBe(0);
      record('premature DELAYED rejected with no attempt');
      // Simulation in this disposable fixture only; no server clock or production override.
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 60000);
      await db.testAttempt.update({ where: { id: final.id }, data: { startedAt: new Date(past.getTime() - 60000), finishedAt: past } });
      const delayed = await card(page, topic.title, 'DELAYED');
      await delayed.getByRole('button', { name: 'Розпочати тест' }).click();
      await takeAttempt(page, 0);
      expect((await db.userTopicProgress.findUniqueOrThrow({ where: { userId_topicId: { userId: 's4_student', topicId: topic.id } } })).status).toBe('MASTERED');
      record('independent DELAYED 6/6 and MASTERED after fixture-only time simulation');
    }
    expect(errors).toEqual([]);
    expect(await db.testAttempt.count({ where: { userId: 's4_student', status: 'COMPLETED' } })).toBe(9);
    expect(await db.answer.count()).toBe(72);
    expect(await db.reviewSchedule.count({ where: { userId: 's4_student' } })).toBeGreaterThan(0);
    expect(await db.$queryRawUnsafe('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    expect(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([]);
    status = 'PASS';
  } finally {
    await db.$disconnect();
    // No control prompts, keys, cookies or private database path in public output.
    writeFileSync('content/station41/browser-QA.json', JSON.stringify({ status, steps, browserErrors: errors, actualSevenDayWait: false, intervalMethod: 'Only fixture-owned FINAL timestamps moved back; server clock unchanged', productionAccessed: false }, null, 2) + '\n');
  }
});

test('final independently reviewed drafts stay unavailable to STUDENT until the unchanged gate is met', async ({ page }) => {
  test.skip(!fixture.draftOnly, 'This guard scenario requires the final draft-only fixture.');
  try {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const topic of fixture.topics) {
      await page.goto(`/learn/${topic.id}`);
      await expect(page.getByRole('heading', { name: 'Матеріал готується', exact: true })).toBeVisible();
      await expect(page.getByRole('tab')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect((await db.topic.findUniqueOrThrow({ where: { id: topic.id } })).coverage).toBe('DRAFT');
    }
    await page.goto('/tests');
    const html = await page.content();
    const controls = await db.question.findMany({ where: { source: { startsWith: 'PRIVATE CONTROL' } }, select: { id: true, prompt: true } });
    expect(controls).toHaveLength(36);
    for (const q of controls) { expect(html).not.toContain(q.id); expect(html).not.toContain(q.prompt); }
    expect(await db.testAttempt.count()).toBe(0);
    writeFileSync('content/station41/draft-guard-QA.json', JSON.stringify({ status: 'PASS', modulesHidden: 3, controlsHidden: 36, attempts: 0, publicationBypassed: false, productionAccessed: false, practiceSha256: (JSON.parse(readFileSync('content/station41/integration-QA.json', 'utf8'))).practiceSha256 }, null, 2) + '\n');
  } finally { await db.$disconnect(); }
});
