import { afterAll, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { parseContentPackage, type ContentPackage } from '@/lib/content-package';
import { lessonReadiness } from '@/lib/readiness';
import { hashPasswordAsync } from '@/lib/auth';
import { gradeAnswer } from '@/lib/grade';
import { DEFAULT_FORMAT } from '@/lib/constants';
const location = process.env.STATION4_QA_LOCATION;
vi.mock('@/lib/prisma', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const folder = mkdtempSync(path.join(tmpdir(), 'nmt-station4-'));
  const database = path.join(folder, 'qa.db');
  return { prisma: new PrismaClient({ datasourceUrl: 'file:' + database.replaceAll('\\', '/') + '?connection_limit=1' }), database, folder };
});
vi.mock('@/server/session', () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: 'owner' }, include: { subjects: true } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));
import { prisma } from '@/lib/prisma';
import { importContentPackage, publishLesson } from '@/server/content-import';
import { verifyQuestion } from '@/server/actions';
import { saveTestSet, setTestPublication } from '@/server/test-sets';
afterAll(async () => { await prisma.$disconnect(); });
const packagePath = 'content/station4/math-foundations.PRACTICE.package.json';
it('validates reviewed Station4.1 PRACTICE modules with exact 4/5/3 and all answer types', () => {
  const parsed = parseContentPackage(readFileSync(packagePath, 'utf8'));
  expect(parsed.report.errors).toEqual([]);
  expect(parsed.package?.provenance.note).toContain('REVIEW-ONLY');
  expect(parsed.package?.sections[0].topics).toHaveLength(3);
  for (const topic of parsed.package!.sections[0].topics) {
    expect(topic.questions).toHaveLength(12);
    expect(topic.lesson.notes.length).toBeGreaterThan(500);
    expect(topic.lesson.examples.length).toBeGreaterThanOrEqual(5);
    expect(lessonReadiness({ lessonJson: JSON.stringify(topic.lesson), questions: topic.questions, videos: [] })).toMatchObject({ theory: true, examples: true, ready: true, counts: { EASY: 4, MEDIUM: 5, HARD: 3 } });
    for (const q of topic.questions) {
      expect(q.source).toContain('PRACTICE');
      if (q.difficulty === 'HARD') { expect(q.type).toBe('SINGLE_CHOICE'); expect(q.options).toHaveLength(5); }
      expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: q.correctAnswer.replace('.', ',') }).isCorrect).toBe(true);
      expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: '999999' }).isCorrect).toBe(false);
    }
  }
});
it.skipIf(!location)('imports reviewed modules into a disposable database through unchanged publication gates', async () => {
  const bankPath = process.env.STATION4_PRIVATE_BANK!;
  if (!path.isAbsolute(bankPath) || path.resolve(bankPath).startsWith(process.cwd() + path.sep)) throw Error('Control bank must remain outside this repository');
  const bank = JSON.parse(readFileSync(bankPath, 'utf8')) as { private: boolean; topics: { topicId: string; questions: ContentPackage['sections'][number]['topics'][number]['questions']; final: string[]; delayed: string[] }[] };
  expect(bank.private).toBe(true);
  const { database, folder } = await import('@/lib/prisma') as unknown as { database: string; folder: string };
  expect(path.dirname(folder)).toBe(path.resolve(tmpdir()));
  expect(path.basename(folder)).toMatch(/^nmt-station4-/);
  writeFileSync(database, '', { flag: 'wx' });
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:' + database.replaceAll('\\', '/') }, stdio: 'pipe', timeout: 60000 });
  const password = randomBytes(20).toString('hex');
  const passwordHash = await hashPasswordAsync(password);
  await prisma.subject.create({ data: { id: 'math', name: 'Математика', shortName: 'Математика', description: 'Ізольований QA Station4', color: '#123456', sortOrder: 0 } });
  for (const id of ['owner', 's4_student', 's4_other']) {
    await prisma.user.create({ data: { id, nickname: id, firstName: id, role: id === 'owner' ? 'OWNER' : 'STUDENT', accountStatus: 'APPROVED', onboarded: true, diagnosticSkipped: true, passwordHash, emailVerifiedAt: new Date() } });
    await prisma.userSettings.create({ data: { id, userId: id, scheduleJson: JSON.stringify({ anchorMockDate: '2026-11-02', rotation: ['math'], externalPractice: { enabled: false, days: [], durationMin: 0 }, days: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, []])) }), formatJson: JSON.stringify(DEFAULT_FORMAT) } });
    await prisma.userSubject.create({ data: { userId: id, subjectId: 'math', active: true, role: 'required' } });
  }
  const parsed = parseContentPackage(readFileSync(packagePath, 'utf8'));
  expect(parsed.report.errors).toEqual([]);
  expect((await importContentPackage(JSON.stringify(parsed.package))).ok).toBe(true);
  for (const q of await prisma.question.findMany()) expect(await verifyQuestion(q.id, 'VERIFIED')).toMatchObject({ ok: true });
  const topics = [];
  for (const topic of parsed.package!.sections[0].topics) {
    const row = await prisma.topic.findUniqueOrThrow({ where: { id: topic.code }, include: { questions: true, videos: true } });
    expect(lessonReadiness(row)).toMatchObject({ ready: true, counts: { EASY: 4, MEDIUM: 5, HARD: 3 } });
    expect(row.coverage).toBe('DRAFT');
    expect(await publishLesson(row.id)).toMatchObject({ ok: true });
    expect((await prisma.topic.findUniqueOrThrow({ where: { id: row.id } })).coverage).not.toBe('DRAFT');
    const control = bank.topics.find(t => t.topicId === row.id)!;
    expect(control.questions).toHaveLength(12);
    const allIds = [...topic.questions, ...control.questions].map(q => q.code);
    expect(new Set(allIds).size).toBe(24);
    expect(new Set([...topic.questions, ...control.questions].map(q => q.prompt)).size).toBe(24);
    for (const q of control.questions) {
      expect(q.type).toBe('NUMERIC');
      await prisma.question.create({ data: { id: q.code, topicId: row.id, subjectId: 'math', type: q.type, difficulty: q.difficulty, prompt: q.prompt, correctAnswer: q.correctAnswer, explanation: q.explanation, source: q.source, verificationStatus: 'DRAFT' } });
      expect(await verifyQuestion(q.code, 'VERIFIED')).toMatchObject({ ok: true });
    }
    const sets: Record<string, string> = {};
    for (const [purpose, questionIds] of [['FINAL', control.final], ['DELAYED', control.delayed]] as const) {
      const result = await saveTestSet({ title: `${purpose === 'FINAL' ? 'Підсумкова перевірка' : 'Відкладена перевірка'} · ${topic.title}`, subjectId: 'math', timeLimitMin: 0, questionIds, assessmentPurpose: purpose });
      expect(result.ok).toBe(true);
      if (!result.ok || !result.id) throw Error('Cannot create QA control');
      expect(await setTestPublication(result.id, 'PUBLISHED')).toMatchObject({ ok: true });
      sets[purpose] = result.id;
    }
    topics.push({ id: row.id, title: topic.title, sets, practiceIds: topic.questions.map(q => q.code) });
  }
  expect(await prisma.testAttempt.count()).toBe(0);
  expect(await prisma.auditLog.count({ where: { action: 'LESSON_PUBLISHED' } })).toBe(3);
  const fixture = { station4: true, synthetic: true, draftOnly: false, folder, database, password, topics };
  writeFileSync(path.join(folder, 'station4-fixture.json'), JSON.stringify(fixture), { flag: 'wx' });
  writeFileSync(location!, JSON.stringify(fixture));
  const publicEvidence = { status: 'PASS', contentAcceptance: 'REVIEW-ONLY: independent AI checks, no teacher or empirical calibration', database: 'unique temporary SQLite', productionAccessed: false, modules: 3, practiceQuestions: 36, privateControls: 36, publication: 'Allowed for all3 by unchanged real gates inside disposable QA fixture only', practiceSha256: createHash('sha256').update(readFileSync(packagePath)).digest('hex') };
  writeFileSync('content/station41/integration-QA.json', JSON.stringify(publicEvidence, null, 2) + '\n');
}, 60000);
