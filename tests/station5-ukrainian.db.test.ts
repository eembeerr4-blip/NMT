import { afterAll, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { parseContentPackage } from '@/lib/content-package';
import { lessonReadiness } from '@/lib/readiness';
import { hashPasswordAsync } from '@/lib/auth';
import { gradeAnswer } from '@/lib/grade';
import { DEFAULT_FORMAT } from '@/lib/constants';
const privateRoot = process.env.STATION5_PRIVATE_ROOT;
let actorId = 'owner';
vi.mock('@/lib/prisma', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const folder = mkdtempSync(path.join(tmpdir(), 'nmt-station5-'));
  const database = path.join(folder, 'qa.db');
  return { prisma: new PrismaClient({ datasourceUrl: 'file:' + database.replaceAll('\\', '/') + '?connection_limit=1' }), database, folder };
});
vi.mock('@/server/session', () => ({ getSessionUser: () => prisma.user.findUnique({ where: { id: actorId }, include: { subjects: true } }), createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }));
import { prisma } from '@/lib/prisma';
import { importContentPackage, publishLesson } from '@/server/content-import';
import { verifyQuestion, startTopicTest } from '@/server/actions';
import { saveTestSet, setTestPublication } from '@/server/test-sets';
afterAll(async () => { await prisma.$disconnect(); });
const paths = ['existing-foundations', 'morphology', 'language-route'].map(name => `content/station5/${name}.PRACTICE.package.json`);
it('validates each candidate, original IDs, NMT formats and correct/wrong grading without a HARD quota', () => {
  const ids: string[] = [];
  for (const file of paths) {
    const parsed = parseContentPackage(readFileSync(file, 'utf8'));
    expect(parsed.report.errors, file).toEqual([]);
    expect(parsed.package!.provenance.note).toContain('REVIEW-ONLY');
    for (const topic of parsed.package!.sections.flatMap(s => s.topics)) {
      expect(topic.lesson.theory.length).toBeGreaterThan(2000);
      expect(topic.lesson.notes.length).toBeGreaterThan(500);
      expect(topic.lesson.rules.length).toBeGreaterThan(0);
      expect(topic.lesson.examples).toHaveLength(6);
      expect(new Set(topic.lesson.sources.map(source => source.url)).size).toBe(topic.lesson.sources.length);
      expect(topic.questions).toHaveLength(12);
      for (const q of topic.questions) {
        ids.push(q.code);
        expect(['SINGLE_CHOICE', 'MATCHING']).toContain(q.type);
        const answer = q.type === 'MATCHING' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
        expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: answer })).toMatchObject({ isCorrect: true, needsManualReview: false });
        expect(gradeAnswer({ type: q.type, correctAnswer: q.correctAnswer, userAnswer: q.type === 'MATCHING' ? {} : 'INVALID' }).isCorrect).toBe(false);
        expect(q.explanation.length).toBeGreaterThan(60);
      }
    }
  }
  expect(ids).toHaveLength(240);
  expect(new Set(ids).size).toBe(ids.length);
});
it.skipIf(!privateRoot)('imports into isolated SQLite, preserves real gates and prepares a separate existing-lesson learner fixture', async () => {
  if (!path.isAbsolute(privateRoot!) || path.resolve(privateRoot!).startsWith(process.cwd() + path.sep)) throw Error('Private source must stay outside repository');
  const { database, folder } = await import('@/lib/prisma') as unknown as { database: string; folder: string };
  expect(path.dirname(folder)).toBe(path.resolve(tmpdir()));
  expect(path.basename(folder)).toMatch(/^nmt-station5-/);
  writeFileSync(database, '', { flag: 'wx' });
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: 'file:' + database.replaceAll('\\', '/') }, stdio: 'pipe', timeout: 60000 });
  const password = randomBytes(20).toString('hex'), passwordHash = await hashPasswordAsync(password);
  await prisma.subject.create({ data: { id: 'ukrainian', name: 'Українська мова', shortName: 'Українська', description: 'Ізольований QA Station5', color: '#123456', sortOrder: 0 } });
  for (const id of ['owner', 's5_student', 's5_other']) {
    await prisma.user.create({ data: { id, nickname: id, firstName: id, role: id === 'owner' ? 'OWNER' : 'STUDENT', accountStatus: 'APPROVED', onboarded: true, diagnosticSkipped: true, passwordHash, emailVerifiedAt: new Date() } });
    await prisma.userSettings.create({ data: { id, userId: id, scheduleJson: JSON.stringify({ anchorMockDate: '2026-11-02', rotation: ['ukrainian'], externalPractice: { enabled: false, days: [], durationMin: 0 }, days: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, []])) }), formatJson: JSON.stringify(DEFAULT_FORMAT) } });
    await prisma.userSubject.create({ data: { userId: id, subjectId: 'ukrainian', active: true, role: 'required' } });
  }
  const candidates = [];
  for (const file of paths) {
    expect((await importContentPackage(readFileSync(file, 'utf8'))).ok).toBe(true);
    const parsed = parseContentPackage(readFileSync(file, 'utf8')).package!;
    for (const t of parsed.sections.flatMap(s => s.topics)) {
      for (const q of t.questions) expect(await verifyQuestion(q.code, 'VERIFIED')).toMatchObject({ ok: true });
      const row = await prisma.topic.findUniqueOrThrow({ where: { id: t.code }, include: { questions: true, videos: true } });
      const readiness = lessonReadiness(row);
      const result = await publishLesson(row.id);
      expect(result.ok).toBe(readiness.ready);
      const after = await prisma.topic.findUniqueOrThrow({ where: { id: row.id } });
      if (!readiness.ready) { expect(after.coverage).toBe('DRAFT'); actorId = 's5_student'; expect(await startTopicTest(row.id)).toMatchObject({ ok: false }); actorId = 'owner'; }
      candidates.push({ id: row.id, title: row.title, ready: readiness.ready, counts: readiness.counts });
    }
  }
  expect(await prisma.testAttempt.count()).toBe(0);
  // Preserve an already available real lesson's state; never relabel a new candidate to bypass readiness.
  const legacy = JSON.parse(readFileSync(path.join(privateRoot!, 'legacy-fixture-source.json'), 'utf8'));
  const t = legacy.topic;
  await prisma.topic.create({ data: { id: t.id, subjectId: 'ukrainian', title: t.title, summary: t.summary, lessonJson: t.lessonJson, coverage: t.coverage, estimatedMin: t.estimatedMin, sortOrder: 100 } });
  for (const q of legacy.questions) await prisma.question.create({ data: { id: q.id, subjectId: 'ukrainian', topicId: t.id, type: q.type, difficulty: q.difficulty, prompt: q.prompt, correctAnswer: q.correctAnswer, explanation: q.explanation, source: q.source, verificationStatus: 'VERIFIED', options: { create: q.options.map((o: { id: string; label: string; text: string; matchKey: string | null; sortOrder: number }) => ({ id: o.id, label: o.label, text: o.text, matchKey: o.matchKey, sortOrder: o.sortOrder })) } } });
  const bank = JSON.parse(readFileSync(path.join(privateRoot!, 'controls.json'), 'utf8'));
  expect(bank.private).toBe(true);
  const practiceIds = legacy.questions.map((q: { id: string }) => q.id);
  for (const q of bank.questions) {
    expect(practiceIds).not.toContain(q.code);
    expect(legacy.questions.map((q: { prompt: string }) => q.prompt)).not.toContain(q.prompt);
    await prisma.question.create({ data: { id: q.code, subjectId: 'ukrainian', topicId: t.id, type: q.type, difficulty: q.difficulty, prompt: q.prompt, correctAnswer: q.code + '-' + q.correctAnswer, explanation: q.explanation, source: q.source, verificationStatus: 'DRAFT', options: { create: q.options.map((o: { label: string; text: string }, i: number) => ({ id: q.code + '-' + o.label, label: o.label, text: o.text, sortOrder: i })) } } });
    expect(await verifyQuestion(q.code, 'VERIFIED')).toMatchObject({ ok: true });
  }
  const sets: Record<string, string> = {};
  for (const purpose of ['FINAL', 'DELAYED'] as const) {
    const result = await saveTestSet({ title: `${purpose} · Station5 QA`, subjectId: 'ukrainian', timeLimitMin: 0, questionIds: purpose === 'FINAL' ? bank.final : bank.delayed, assessmentPurpose: purpose });
    if (!result.ok || !result.id) throw Error('Control set creation failed');
    expect(await setTestPublication(result.id, 'PUBLISHED')).toMatchObject({ ok: true }); sets[purpose] = result.id;
  }
  const fixture = { station5: true, synthetic: true, folder, database, password, candidates, legacy: { id: t.id, title: t.title, practiceIds, sets } };
  writeFileSync(path.join(folder, 'station5-fixture.json'), JSON.stringify(fixture), { flag: 'wx' });
  writeFileSync(path.join(privateRoot!, 'fixture-location.json'), JSON.stringify(fixture));
  writeFileSync('content/station5/integration-QA.json', JSON.stringify({ status: 'PASS', productionWrites: false, candidates, questionsImported: 240, gatesUnchanged: true, privateControls: 12, controlBankScope: 'QA-only original candidate; not a complete Ukrainian assessment system', legacyStatePreserved: true, packageHashes: Object.fromEntries(paths.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])) }, null, 2) + '\n');
}, 120000);
