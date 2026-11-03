import { afterAll, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseContentPackage, planContentPackage } from '@/lib/content-package';
import { gradeAnswer } from '@/lib/grade';
import { lessonAccess } from '@/lib/readiness';
import { trainingQuestionWhere } from '@/server/assessment';

let actorId = 'reconcile-owner';
vi.mock('@/lib/prisma', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const folder = mkdtempSync(path.join(tmpdir(), 'nmt-s5-reconcile-'));
  const database = path.join(folder, 'qa.db');
  return { prisma: new PrismaClient({ datasourceUrl: 'file:' + database.replaceAll('\\', '/') + '?connection_limit=1' }), database, folder };
});
vi.mock('@/server/session', () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: actorId }, include: { subjects: true } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));
import { prisma } from '@/lib/prisma';
import { importContentPackage } from '@/server/content-import';
import { startTopicTest } from '@/server/actions';

const prefix = 'content/station5/';
const files = ['language-route.PRACTICE.package.json', 'morphology.PRACTICE.package.json', 'reconciliation/reading-extension.REVIEW-ONLY.package.json', 'reconciliation/legacy-corrections.REVIEW-ONLY.package.json'];
const raw = (file: string) => readFileSync(prefix + file, 'utf8');
const pkg = (file: string) => parseContentPackage(raw(file)).package!;
const topics = (file: string) => pkg(file).sections.flatMap(s => s.topics);
afterAll(async () => { await prisma.$disconnect(); });

it('validates changed packages, fresh importer plans, unique new IDs and every changed/new key', () => {
  for (const file of files) {
    const parsed = parseContentPackage(raw(file));
    expect(parsed.report.errors, file).toEqual([]);
    expect(parsed.package!.provenance.note).toContain('REVIEW-ONLY');
    const plan = planContentPackage(parsed.package!, { subject: { id: 'ukrainian', name: 'QA' }, topics: [], questions: [], videos: [] });
    expect(plan.report.errors, file).toEqual([]);
  }
  const reading = topics(files[2])[0];
  expect(reading.questions).toHaveLength(24);
  const oldIds = ['existing-foundations.PRACTICE.package.json', ...files.slice(0, 2)].flatMap(f => topics(f).flatMap(t => t.questions.map(q => q.code)));
  const all = [...oldIds, ...reading.questions.map(q => q.code)];
  expect(oldIds).toHaveLength(240);
  expect(new Set(all).size).toBe(264);
  const changed = topics(files[0]).flatMap(t => t.questions).filter(q => q.code === 's5-ukr-asyndetic-p06');
  const revised = [...changed, ...reading.questions, ...topics(files[3]).flatMap(t => t.questions)];
  expect(revised).toHaveLength(29);
  for (const q of revised) {
    expect(q.options.filter(o => o.label === q.correctAnswer)).toHaveLength(1);
    expect(new Set(q.options.map(o => o.text)).size).toBe(q.options.length);
    expect(q.explanation.length).toBeGreaterThan(90);
    for (const option of q.options) {
      expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: option.label }).isCorrect, q.code + option.label).toBe(option.label === q.correctAnswer);
    }
  }
  expect(reading.lesson.examples).toHaveLength(6);
  expect(reading.questions.some(q => q.difficulty === 'HARD')).toBe(false);
});

it('limits baseline edits to one prompt and two worked explanations; preserves all other content and keys', () => {
  for (const file of files.slice(0, 2)) {
    const previous = JSON.parse(execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'show', `a2cbabd0a0e847bb4d4946462d81fa3e26c44fbb:${prefix + file}`], { encoding: 'utf8' }));
    const current = JSON.parse(raw(file));
    for (const section of current.sections) for (const topic of section.topics) {
      const old = previous.sections.flatMap((s: { topics: typeof section.topics }) => s.topics).find((t: typeof topic) => t.code === topic.code);
      expect(old).toBeDefined();
      if (topic.code === 's5-ukr-phonetics') old.lesson.examples[4].solution = topic.lesson.examples[4].solution;
      if (topic.code === 's5-ukr-verb') old.lesson.examples[3].solution = topic.lesson.examples[3].solution;
      if (topic.code === 's5-ukr-asyndetic') {
        const q = topic.questions.find((q: { code: string }) => q.code === 's5-ukr-asyndetic-p06');
        const qCode = 's5-ukr-asyndetic-p06';
        const index = old.questions.findIndex((q: { code: string }) => q.code === qCode);
        expect(q.correctAnswer).toBe(old.questions[index].correctAnswer);
        old.questions[index] = q;
      }
    }
    expect(current).toEqual(previous);
  }
});

it('imports into a new disposable SQLite, protects published legacy rows, denies DRAFT practice and reserves synthetic controls', async () => {
  const { database, folder } = await import('@/lib/prisma') as unknown as { database: string; folder: string };
  expect(path.dirname(folder)).toBe(path.resolve(tmpdir()));
  expect(path.basename(folder)).toMatch(/^nmt-s5-reconcile-/);
  writeFileSync(database, '', { flag: 'wx' });
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:' + database.replaceAll('\\', '/') }, stdio: 'pipe', timeout: 60000 });
  await prisma.subject.create({ data: { id: 'ukrainian', name: 'QA Ukrainian', shortName: 'QA', description: 'Synthetic only', color: '#123456', sortOrder: 0 } });
  for (const id of ['reconcile-owner', 'reconcile-student']) {
    await prisma.user.create({ data: { id, nickname: id, firstName: 'Synthetic', role: id.endsWith('owner') ? 'OWNER' : 'STUDENT', accountStatus: 'APPROVED', onboarded: true } });
    await prisma.userSubject.create({ data: { userId: id, subjectId: 'ukrainian', active: true, role: 'required' } });
  }
  for (const t of topics(files[3])) await prisma.topic.create({ data: { id: t.code, subjectId: 'ukrainian', title: 'Protected synthetic legacy', lessonJson: JSON.stringify(t.lesson), coverage: 'PARTIAL', sortOrder: 0 } });
  const protectedBefore = await prisma.topic.findMany({ where: { id: { in: topics(files[3]).map(t => t.code) } } });
  for (const file of files) expect(await importContentPackage(raw(file)), file).toMatchObject({ ok: true });
  expect(await prisma.topic.findMany({ where: { id: { in: topics(files[3]).map(t => t.code) } } })).toEqual(protectedBefore);
  expect(await prisma.question.count()).toBe(216);
  expect(await prisma.question.count({ where: { verificationStatus: { not: 'DRAFT' } } })).toBe(0);
  expect(await prisma.question.count({ where: { id: { in: topics(files[3]).flatMap(t => t.questions.map(q => q.code)) } } })).toBe(0);
  actorId = 'reconcile-student';
  for (const t of [...topics(files[0]), ...topics(files[1]), ...topics(files[2])]) {
    const row = await prisma.topic.findUniqueOrThrow({ where: { id: t.code } });
    expect(row.coverage).toBe('DRAFT');
    expect(lessonAccess({ ...row, questions: [{ id: 'synthetic' }] }).available).toBe(false);
    expect(await startTopicTest(t.code)).toMatchObject({ ok: false });
  }
  expect(await prisma.testAttempt.count()).toBe(0);
  const controlId = 'synthetic-reconcile-control';
  await prisma.question.create({ data: { id: controlId, subjectId: 'ukrainian', topicId: 's5-ukr-reading-extension', type: 'SINGLE_CHOICE', difficulty: 'EASY', prompt: 'Synthetic control placeholder, not an educational bank', correctAnswer: 'placeholder', explanation: 'Synthetic isolation probe', verificationStatus: 'VERIFIED' } });
  for (const kind of ['FINAL', 'DELAYED']) {
    await prisma.test.create({ data: { subjectId: 'ukrainian', title: 'Synthetic reserved control', kind, questions: { create: { questionId: controlId, sortOrder: 0 } } } });
  }
  expect(await prisma.question.findMany({ where: { id: controlId, ...trainingQuestionWhere } })).toEqual([]);
}, 120000);
