"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiPackSchema, completeAI, extractJson, probeOllama, type AIMessage } from "@/lib/ai";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE, ELECTIVE_SUBJECT_IDS, REQUIRED_SUBJECT_IDS, type ScheduleConfig } from "@/lib/constants";
import { addDateKeys, dateKey, noonUtc } from "@/lib/dates";
import { gradeAnswer, parseNumber, pickBalanced } from "@/lib/grade";
import { learningStatus, reviewIntervals } from "@/lib/mastery";
import { prisma } from "@/lib/prisma";
import { readSecrets, writeSecrets } from "@/lib/secrets";
import { examResultSchema, preferencesSchema, questionSchema } from "@/lib/validators";
import { parseYouTubeId, searchYouTube as searchYouTubeApi, youtubeSearchUrl, youtubeWatchUrl } from "@/lib/youtube";
import { personalSchedule } from "@/lib/plan";
import { relocationMode } from "@/lib/shift";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { addXp, refreshAchievements } from "@/server/progress";
import { clearSession, createSession, getSessionUser } from "@/server/session";
import { getSettings, syncPlan } from "@/server/sync";

export type ActionState = { ok: true; message?: string; id?: string } | { ok: false; error: string };

function refresh() {
  revalidatePath("/", "layout");
}

async function actor() {
  const user = await getSessionUser();
  if (!user) throw new Error("Потрібен вхід до профілю.");
  return user;
}

function fail(error: unknown): ActionState {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Перевірте поля форми." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Не вдалося виконати дію." };
}

async function readableAnswer(questionId: string, value: unknown) {
  const question = await prisma.question.findUnique({ where: { id: questionId }, include: { options: true } });
  if (!question) return String(value ?? "—");
  const options = new Map(question.options.map((option) => [option.id, option.text]));
  if (question.type === "SINGLE_CHOICE") return options.get(String(value)) ?? "Відповіді немає";
  if (question.type === "SEQUENCE" && Array.isArray(value)) return value.map((id) => options.get(String(id)) ?? String(id)).join(" → ");
  if (question.type === "MATCHING" && value && typeof value === "object") {
    return Object.entries(value as Record<string, string>).map(([left, right]) => `${options.get(left) ?? left} → ${options.get(right) ?? right}`).join("; ");
  }
  if (value && typeof value === "object" && "final" in value) {
    const step = value as { work?: string; final?: string };
    return `Відповідь: ${step.final || "—"}${step.work ? `. Хід: ${step.work}` : ""}`;
  }
  return String(value ?? "—");
}

export async function addVideo(topicId: string, rawUrl: string, title: string, role = "primary"): Promise<ActionState> {
  try {
    await actor();
    const youtubeId = parseYouTubeId(rawUrl);
    if (!youtubeId) return { ok: false, error: "Це не схоже на посилання YouTube. Назву каналу чи відео сайт не вигадує." };
    const allowed = ["primary", "simple", "examples", "tasks"];
    const safeRole = allowed.includes(role) ? role : "primary";
    const existing = await prisma.videoLesson.findFirst({ where: { topicId, youtubeId } });
    if (existing) {
      await prisma.videoLesson.update({ where: { id: existing.id }, data: { title: title.trim() || existing.title, role: safeRole, reviewStatus: "CONFIRMED", url: youtubeWatchUrl(youtubeId) } });
      refresh();
      return { ok: true, id: existing.id, message: "Це відео вже було в темі. Його підтверджено, дублікат не створено." };
    }
    const count = await prisma.videoLesson.count({ where: { topicId, reviewStatus: { not: "REJECTED" } } });
    const video = await prisma.videoLesson.create({
      data: {
        topicId,
        youtubeId,
        url: youtubeWatchUrl(youtubeId),
        title: title.trim(),
        role: safeRole,
        reviewStatus: "CONFIRMED",
        isPrimary: count === 0 || safeRole === "primary",
      },
    });
    await prisma.topic.update({ where: { id: topicId }, data: { status: "IN_PROGRESS" } }).catch(() => undefined);
    refresh();
    return { ok: true, id: video.id };
  } catch (error) {
    return fail(error);
  }
}

export async function updateVideo(id: string, rawUrl: string, title: string): Promise<ActionState> {
  try {
    const youtubeId = parseYouTubeId(rawUrl);
    if (!youtubeId) return { ok: false, error: "Вкажіть коректне посилання YouTube." };
    await prisma.videoLesson.update({
      where: { id },
      data: { youtubeId, url: youtubeWatchUrl(youtubeId), title: title.trim(), lastPositionSec: 0 },
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteVideo(id: string): Promise<ActionState> {
  try {
    const video = await prisma.videoLesson.delete({ where: { id } });
    const next = await prisma.videoLesson.findFirst({ where: { topicId: video.topicId }, orderBy: { createdAt: "asc" } });
    if (next && video.isPrimary) await prisma.videoLesson.update({ where: { id: next.id }, data: { isPrimary: true } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function makePrimary(id: string): Promise<ActionState> {
  try {
    const video = await prisma.videoLesson.findUnique({ where: { id } });
    if (!video) return { ok: false, error: "Відео не знайдено." };
    await prisma.videoLesson.updateMany({ where: { topicId: video.topicId }, data: { isPrimary: false } });
    await prisma.videoLesson.update({ where: { id }, data: { isPrimary: true } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveVideoNotes(id: string, notes: string): Promise<ActionState> {
  try {
    await prisma.videoLesson.update({ where: { id }, data: { notes } });
    refresh();
    return { ok: true, message: "Нотатки збережено." };
  } catch (error) {
    return fail(error);
  }
}

export async function saveVideoPosition(id: string, seconds: number, durationSec?: number): Promise<ActionState> {
  try {
    await prisma.videoLesson.update({
      where: { id },
      data: {
        lastPositionSec: Math.max(0, Math.floor(seconds)),
        ...(durationSec && durationSec > 0 ? { durationSec: Math.floor(durationSec) } : {}),
      },
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function searchYouTube(query: string, topicId?: string) {
  await actor();
  const searchUrl = youtubeSearchUrl(query);
  const found = await searchYouTubeApi(query, readSecrets().youtubeApiKey);
  if (!found.ok) return { ok: false as const, error: found.reason, searchUrl: found.searchUrl };
  const unique = new Map<string, { id: string; title: string; channel: string }>();
  for (const item of found.items) unique.set(item.youtubeId, { id: item.youtubeId, title: item.title, channel: item.channel });
  if (topicId) {
    for (const item of unique.values()) {
      const existing = await prisma.videoLesson.findFirst({ where: { topicId, youtubeId: item.id } });
      if (existing) {
        if (existing.reviewStatus !== "REJECTED") {
          await prisma.videoLesson.update({ where: { id: existing.id }, data: { title: item.title, channel: item.channel } });
        }
        continue;
      }
      await prisma.videoLesson.create({
        data: { topicId, youtubeId: item.id, url: youtubeWatchUrl(item.id), title: item.title, channel: item.channel, role: "simple", reviewStatus: "SUGGESTED", isPrimary: false },
      });
    }
    refresh();
  }
  return { ok: true as const, items: [...unique.values()], searchUrl };
}

export async function setVideoReview(id: string, status: "CONFIRMED" | "REJECTED"): Promise<ActionState> {
  try {
    await actor();
    await prisma.videoLesson.update({ where: { id }, data: { reviewStatus: status, isPrimary: status === "CONFIRMED" ? undefined : false } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setVideoRole(id: string, role: string): Promise<ActionState> {
  try {
    await actor();
    const allowed = ["primary", "simple", "examples", "tasks"];
    if (!allowed.includes(role)) return { ok: false, error: "Невідомий тип лекції." };
    await prisma.videoLesson.update({ where: { id }, data: { role, isPrimary: role === "primary" } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveNote(input: { id?: string; title: string; content: string; topicId?: string; subjectId?: string }): Promise<ActionState> {
  try {
    if (!input.title.trim() || !input.content.trim()) return { ok: false, error: "Додайте заголовок і текст конспекту." };
    if (input.id) {
      await prisma.note.update({ where: { id: input.id }, data: { title: input.title.trim(), content: input.content, topicId: input.topicId || null, subjectId: input.subjectId || null } });
    } else {
      await prisma.note.create({ data: { title: input.title.trim(), content: input.content, topicId: input.topicId || null, subjectId: input.subjectId || null, userId: (await actor()).id } });
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteNote(id: string): Promise<ActionState> {
  try {
    await prisma.note.delete({ where: { id } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveQuestion(raw: unknown): Promise<ActionState> {
  try {
    const data = questionSchema.parse(raw);
    const id = data.id || randomUUID();
    await prisma.question.upsert({
      where: { id },
      update: {
        subjectId: data.subjectId,
        topicId: data.topicId,
        subtopic: data.subtopic,
        type: data.type,
        difficulty: data.difficulty,
        prompt: data.prompt,
        explanation: data.explanation,
        correctAnswer: data.correctAnswer,
        source: data.source,
        verificationStatus: data.verificationStatus,
      },
      create: {
        id,
        subjectId: data.subjectId,
        topicId: data.topicId,
        subtopic: data.subtopic,
        type: data.type,
        difficulty: data.difficulty,
        prompt: data.prompt,
        explanation: data.explanation,
        correctAnswer: data.correctAnswer,
        source: data.source || "Додано вручну",
        verificationStatus: data.verificationStatus,
        generatedByAi: false,
      },
    });
    await prisma.questionOption.deleteMany({ where: { questionId: id } });
    if (data.options.length) {
      await prisma.questionOption.createMany({
        data: data.options.map((option, index) => ({
          questionId: id,
          label: option.label,
          text: option.text,
          matchKey: option.matchKey,
          sortOrder: index,
        })),
      });
    }
    refresh();
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteQuestion(id: string): Promise<ActionState> {
  try {
    await prisma.question.delete({ where: { id } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function importQuestions(rawJson: string): Promise<ActionState> {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    const items = z.array(questionSchema).parse(parsed);
    for (const item of items) await saveQuestion({ ...item, id: undefined, verificationStatus: "PENDING_REVIEW" });
    return { ok: true, message: `Імпортовано ${items.length}. Статус: очікує перевірки.` };
  } catch (error) {
    return fail(error);
  }
}

export async function reportQuestion(id: string, issue: string): Promise<ActionState> {
  try {
    await prisma.question.update({ where: { id }, data: { issueReport: issue.slice(0, 1000), verificationStatus: "PENDING_REVIEW" } });
    refresh();
    return { ok: true, message: "Зауваження збережено. Завдання знято з перевірених, доки ви його не підтвердите." };
  } catch (error) {
    return fail(error);
  }
}

export async function verifyQuestion(id: string, status: "VERIFIED" | "DRAFT" | "REJECTED"): Promise<ActionState> {
  try {
    await prisma.question.update({ where: { id }, data: { verificationStatus: status } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function startTopicTest(topicId: string) {
  const user = await actor();
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return { ok: false as const, error: "Тему не знайдено." };
  const bank = await prisma.question.findMany({ where: { topicId, verificationStatus: "VERIFIED" } });
  if (bank.length === 0) return { ok: false as const, error: "Немає перевірених завдань для цієї теми. Додайте їх у банку. Сайт не підставляє вигадані офіційні питання." };
  const picked = pickBalanced(bank);
  const test = await prisma.test.create({
    data: {
      subjectId: topic.subjectId,
      topicId,
      title: `Тематичний тест: ${topic.title}`,
      kind: "TOPIC",
      configJson: JSON.stringify({ convertsToRating: false, shortfall: picked.shortfall, actual: picked.questions.length }),
      questions: { create: picked.questions.map((question, index) => ({ questionId: question.id, sortOrder: index })) },
    },
  });
  const attempt = await prisma.testAttempt.create({ data: { testId: test.id, userId: user.id } });
  await prisma.userTopicProgress.upsert({
    where: { userId_topicId: { userId: user.id, topicId } },
    update: {},
    create: { userId: user.id, topicId, status: "IN_PROGRESS" },
  });
  redirect(`/tests/${attempt.id}`);
}

export async function startExam(input: { subjectId: string; title: string; count: number; minutes: number | null }) {
  const user = await actor();
  const settings = await getSettings(user.id);
  if (!settings.format.officialFormatConfirmed) {
    // The exam can still run from the user's own verified bank. Rating conversion stays disabled.
  }
  const bank = await prisma.question.findMany({ where: { subjectId: input.subjectId, verificationStatus: "VERIFIED" } });
  if (bank.length === 0) return { ok: false as const, error: "У предметі немає перевірених завдань для пробника." };
  const wanted = Math.max(1, Math.min(60, input.count || bank.length));
  const picked = pickBalanced(bank, scaleTargets(wanted));
  const test = await prisma.test.create({
    data: {
      subjectId: input.subjectId,
      title: input.title.trim() || "Пробник",
      kind: "EXAM",
      timeLimitSec: input.minutes ? input.minutes * 60 : null,
      configJson: JSON.stringify({
        year: settings.format.year,
        officialFormatConfirmed: settings.format.officialFormatConfirmed,
        convertsToRating: false,
        requested: wanted,
        actual: picked.questions.length,
      }),
      questions: { create: picked.questions.map((question, index) => ({ questionId: question.id, sortOrder: index })) },
    },
  });
  const attempt = await prisma.testAttempt.create({ data: { testId: test.id, userId: user.id } });
  redirect(`/tests/${attempt.id}`);
}

function scaleTargets(total: number) {
  const easy = Math.round(total * (4 / 12));
  const hard = Math.round(total * (3 / 12));
  const medium = Math.max(0, total - easy - hard);
  return { EASY: easy, MEDIUM: medium, HARD: hard };
}

export async function saveDraft(attemptId: string, draft: Record<string, unknown>, currentIndex: number): Promise<ActionState> {
  try {
    const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.status !== "IN_PROGRESS") return { ok: false, error: "Спробу вже завершено." };
    await prisma.testAttempt.update({ where: { id: attemptId }, data: { draftJson: JSON.stringify(draft), currentIndex } });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function finishAttempt(attemptId: string, draft: Record<string, unknown>): Promise<ActionState> {
  try {
    const user = await actor();
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { test: { include: { questions: { include: { question: true }, orderBy: { sortOrder: "asc" } } } } },
    });
    if (!attempt || attempt.userId !== user.id || attempt.status !== "IN_PROGRESS") return { ok: false, error: "Спробу вже завершено або вона належить іншому профілю." };
    const settings = await getSettings(user.id);
    await prisma.answer.deleteMany({ where: { attemptId } });
    let correct = 0;
    let pending = 0;
    for (const row of attempt.test.questions) {
      const question = row.question;
      const userValue = draft[question.id] ?? null;
      const graded = gradeAnswer({ type: question.type, correctAnswer: question.correctAnswer, userAnswer: userValue });
      if (graded.isCorrect) correct += 1;
      if (graded.needsManualReview) pending += 1;
      await prisma.answer.create({
        data: {
          attemptId,
          questionId: question.id,
          userAnswer: JSON.stringify(userValue),
          isCorrect: graded.isCorrect,
          needsManualReview: graded.needsManualReview,
        },
      });
      if (graded.isCorrect === false && question.topicId) {
        await rememberMistake(question, userValue);
      }
    }
    const total = attempt.test.questions.length;
    const durationSec = Math.max(1, Math.round((Date.now() - attempt.startedAt.getTime()) / 1000));
    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        durationSec,
        draftJson: JSON.stringify(draft),
        correctCount: correct,
        totalCount: total,
        pendingCount: pending,
        percent: total ? (correct / total) * 100 : 0,
      },
    });
    if (attempt.test.topicId && pending === 0) {
      await applyMastery(attempt.test.topicId, correct, total, settings.masteryHighMin, settings.masteryMidMin);
    } else if (attempt.test.topicId) {
      await prisma.topic.update({ where: { id: attempt.test.topicId }, data: { status: "IN_PROGRESS", lastCorrect: correct, lastTotal: total } });
    }
    await prisma.studySession.create({
      data: {
        subjectId: attempt.test.subjectId,
        topicId: attempt.test.topicId,
        startedAt: attempt.startedAt,
        endedAt: new Date(),
        durationMin: Math.max(1, Math.round(durationSec / 60)),
        kind: attempt.test.kind === "EXAM" ? "mock" : "test",
        userId: user.id,
      },
    });
    if (attempt.test.topicId) await completeOpenTask(user.id, attempt.test.topicId);
    await addXp(30 + correct * 2, "Завершений тест");
    await refreshAchievements();
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

async function rememberMistake(question: { id: string; subjectId: string; topicId: string | null; prompt: string; explanation: string; correctAnswer: string; type: string }, userValue: unknown) {
  const user = await actor();
  const existing = await prisma.mistake.findFirst({ where: { userId: user.id, questionId: question.id, status: { not: "FIXED" } } });
  const userAnswer = await readableAnswer(question.id, userValue);
  const correctAnswer = await readableCorrect(question);
  if (existing) {
    await prisma.mistake.update({
      where: { id: existing.id },
      data: { repeatCount: { increment: 1 }, userAnswer, date: new Date(), status: "OPEN" },
    });
    return;
  }
  await prisma.mistake.create({
    data: {
      subjectId: question.subjectId,
      topicId: question.topicId,
      questionId: question.id,
      prompt: question.prompt,
      userAnswer,
      correctAnswer,
      explanation: question.explanation,
      userId: user.id,
    },
  });
}

async function readableCorrect(question: { id: string; type: string; correctAnswer: string }) {
  if (question.type === "SINGLE_CHOICE") return readableAnswer(question.id, question.correctAnswer);
  if (question.type === "SEQUENCE" || question.type === "MATCHING") {
    try {
      return readableAnswer(question.id, JSON.parse(question.correctAnswer));
    } catch {
      return question.correctAnswer;
    }
  }
  return question.correctAnswer;
}

async function completeOpenTask(userId: string, topicId: string) {
  const task = await prisma.studyTask.findFirst({
    where: { userId, topicId, status: { in: ["PLANNED", "IN_PROGRESS"] }, dateKey: { lte: dateKey() } },
    orderBy: { dateKey: "asc" },
  });
  if (!task) return;
  await prisma.studyTask.update({ where: { id: task.id }, data: { status: "DONE", completedAt: new Date() } });
}

export async function completeLesson(topicId: string, studied: boolean): Promise<ActionState> {
  try {
    const user = await actor();
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return { ok: false, error: "Тему не знайдено." };
    const verified = await prisma.question.count({ where: { topicId, verificationStatus: "VERIFIED" } });
    const attempt = await prisma.testAttempt.findFirst({
      where: { userId: user.id, status: "COMPLETED", test: { topicId } },
      orderBy: { finishedAt: "desc" },
    });
    if (verified > 0 && !attempt) return { ok: false, error: "Спочатку завершіть домашнє завдання. Відкриття сторінки урок не зараховує." };
    if (verified === 0 && !studied) return { ok: false, error: "Позначте, що конспект опрацьовано. Для цієї теми ще немає перевірених завдань." };
    const progress = await prisma.userTopicProgress.findUnique({ where: { userId_topicId: { userId: user.id, topicId } } });
    if (!progress || progress.status === "NOT_STARTED") {
      await prisma.userTopicProgress.upsert({
        where: { userId_topicId: { userId: user.id, topicId } },
        update: { status: "IN_PROGRESS" },
        create: { userId: user.id, topicId, status: "IN_PROGRESS" },
      });
    }
    await completeOpenTask(user.id, topicId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const logged = await prisma.studySession.findFirst({ where: { userId: user.id, topicId, startedAt: { gte: todayStart } } });
    if (!logged) {
      await prisma.studySession.create({
        data: { userId: user.id, subjectId: topic.subjectId, topicId, startedAt: new Date(Date.now() - topic.estimatedMin * 60 * 1000), endedAt: new Date(), durationMin: topic.estimatedMin, kind: "lesson" },
      });
    }
    const pending = await prisma.reviewSchedule.count({ where: { userId: user.id, topicId, status: "PENDING" } });
    if (pending === 0) {
      await prisma.reviewSchedule.create({ data: { userId: user.id, topicId, dueKey: addDateKeys(dateKey(), 1), intervalDays: 1, priority: 1, status: "PENDING" } });
    }
    refresh();
    return { ok: true, message: "Урок зараховано. Повторення стоїть у календарі." };
  } catch (error) {
    return fail(error);
  }
}

async function applyMastery(topicId: string, correct: number, total: number, highMin: number, midMin: number) {
  const user = await actor();
  const status = learningStatus(correct, total, highMin, midMin);
  const repeats = await prisma.mistake.aggregate({ where: { userId: user.id, topicId, status: { not: "FIXED" } }, _sum: { repeatCount: true } });
  await prisma.userTopicProgress.upsert({
    where: { userId_topicId: { userId: user.id, topicId } },
    update: { status, lastCorrect: correct, lastTotal: total },
    create: { userId: user.id, topicId, status, lastCorrect: correct, lastTotal: total },
  });
  await prisma.reviewSchedule.deleteMany({ where: { userId: user.id, topicId, status: "PENDING" } });
  const intervals = reviewIntervals(correct, total, highMin, midMin, repeats._sum.repeatCount ?? 0);
  const priority = status === "MASTERED" ? 0 : status === "NEEDS_REVIEW" ? 1 : 3;
  await prisma.reviewSchedule.createMany({
    data: intervals.map((days) => ({
      topicId,
      userId: user.id,
      dueKey: addDateKeys(dateKey(), days),
      intervalDays: days,
      priority,
      status: "PENDING",
    })),
  });
}

export async function gradeManually(answerId: string, correct: boolean): Promise<ActionState> {
  try {
    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: { isCorrect: correct, needsManualReview: false },
      include: { attempt: { include: { test: true } }, question: true },
    });
    if (!correct && answer.question.topicId) await rememberMistake(answer.question, JSON.parse(answer.userAnswer));
    const answers = await prisma.answer.findMany({ where: { attemptId: answer.attemptId } });
    const correctCount = answers.filter((item) => item.isCorrect).length;
    const pending = answers.filter((item) => item.needsManualReview).length;
    await prisma.testAttempt.update({
      where: { id: answer.attemptId },
      data: { correctCount, pendingCount: pending, percent: answers.length ? (correctCount / answers.length) * 100 : 0 },
    });
    if (pending === 0 && answer.attempt.test.topicId) {
      const settings = await getSettings();
      await applyMastery(answer.attempt.test.topicId, correctCount, answers.length, settings.masteryHighMin, settings.masteryMidMin);
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveExamResult(raw: unknown): Promise<ActionState> {
  try {
    const user = await actor();
    const data = examResultSchema.parse(raw);
    const payload = {
      subjectId: data.subjectId,
      date: noonUtc(data.date),
      testType: data.partial ? "PARTIAL" : data.testType,
      title: data.title,
      source: data.source,
      rawScore: data.rawScore,
      maxRawScore: data.maxRawScore,
      ratingScore: data.ratingScore,
      belowThreshold: data.belowThreshold,
      partial: data.partial || data.testType === "PARTIAL",
      countsTowardAverage: data.countsTowardAverage && data.ratingScore !== null && !data.partial && data.testType !== "PARTIAL" && !data.belowThreshold,
      durationSec: data.durationMin === null ? null : data.durationMin * 60,
      errorCount: data.errorCount,
      comment: data.comment,
    };
    if (data.id) {
      const existing = await prisma.examResult.findUnique({ where: { id: data.id } });
      if (!existing || existing.userId !== user.id) return { ok: false, error: "Цей результат належить іншому профілю." };
      await prisma.examResult.update({ where: { id: data.id }, data: payload });
    } else await prisma.examResult.create({ data: { ...payload, userId: user.id } });
    await addXp(20, "Записаний результат");
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteExamResult(id: string): Promise<ActionState> {
  try {
    const user = await actor();
    if (id.startsWith("seed-")) return { ok: false, error: "Стартовий історичний запис краще редагувати, а не видаляти. Якщо це помилка, змініть поля." };
    const existing = await prisma.examResult.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) return { ok: false, error: "Цей результат належить іншому профілю." };
    await prisma.examResult.delete({ where: { id } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setTaskStatus(id: string, status: "PLANNED" | "IN_PROGRESS" | "DONE" | "SKIPPED"): Promise<ActionState> {
  try {
    const user = await actor();
    const current = await prisma.studyTask.findUnique({ where: { id } });
    if (!current || current.userId !== user.id) return { ok: false, error: "Це заняття належить іншому профілю." };
    const task = await prisma.studyTask.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
    if (status === "DONE" && task.kind !== "rest" && task.durationMin > 0) {
      await prisma.studySession.create({
        data: {
          userId: user.id,
          subjectId: task.subjectId,
          topicId: task.topicId,
          startedAt: new Date(),
          endedAt: new Date(),
          durationMin: task.durationMin,
          kind: task.kind,
        },
      });
      await addXp(15, "Завершене заняття");
      await refreshAchievements();
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function moveTask(id: string, nextDate: string): Promise<ActionState> {
  try {
    const user = await actor();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return { ok: false, error: "Оберіть дату." };
    const task = await prisma.studyTask.findUnique({ where: { id } });
    if (!task || task.userId !== user.id || task.status === "DONE") return { ok: false, error: "Завершене заняття не переноситься." };
    if (relocationMode(task) === "update") {
      await prisma.studyTask.update({ where: { id }, data: { dateKey: nextDate, status: "PLANNED" } });
    } else {
      await prisma.studyTask.update({ where: { id }, data: { status: "MOVED" } });
      await prisma.studyTask.create({
        data: {
          dateKey: nextDate,
          subjectId: task.subjectId,
          topicId: task.topicId,
          title: task.title,
          detail: task.detail,
          kind: task.kind,
          durationMin: task.durationMin,
          optional: task.optional,
          sortOrder: task.sortOrder,
          notes: task.notes,
          templateKey: `moved-${task.id}`,
          movedFromId: task.id,
          userId: user.id,
          status: "PLANNED",
        },
      });
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function createCustomTask(input: { dateKey: string; title: string; subjectId?: string; durationMin: number; kind?: string }): Promise<ActionState> {
  try {
    const user = await actor();
    if (!input.title.trim()) return { ok: false, error: "Вкажіть назву заняття." };
    await prisma.studyTask.create({
      data: {
        userId: user.id,
        dateKey: input.dateKey,
        title: input.title.trim(),
        subjectId: input.subjectId || null,
        durationMin: Math.max(0, input.durationMin),
        kind: input.kind || "custom",
        templateKey: `custom-${randomUUID()}`,
        detail: "Власне заняття",
      },
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function recalculateFuturePlan(): Promise<ActionState> {
  try {
    const today = dateKey();
    const planned = await prisma.studyTask.findMany({ where: { status: "PLANNED", dateKey: { gte: today } } });
    const ids = planned.filter((task) => task.templateKey?.startsWith("d")).map((task) => task.id);
    if (ids.length) await prisma.studyTask.deleteMany({ where: { id: { in: ids } } });
    await syncPlan();
    refresh();
    return { ok: true, message: "Майбутні заплановані заняття перераховано. Виконані й перенесені залишились." };
  } catch (error) {
    return fail(error);
  }
}

export async function logStudyMinutes(input: { subjectId?: string; topicId?: string; minutes: number; note?: string }): Promise<ActionState> {
  try {
    if (input.minutes <= 0) return { ok: false, error: "Вкажіть тривалість у хвилинах." };
    await prisma.studySession.create({
      data: {
        subjectId: input.subjectId || null,
        topicId: input.topicId || null,
        startedAt: new Date(),
        endedAt: new Date(),
        durationMin: input.minutes,
        kind: "study",
        note: input.note ?? "",
      },
    });
    await addXp(10, "Записаний навчальний час");
    await refreshAchievements();
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function completeReview(id: string): Promise<ActionState> {
  try {
    await prisma.reviewSchedule.update({ where: { id }, data: { status: "DONE", completedAt: new Date() } });
    await addXp(10, "Повторення");
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewFlashcard(id: string, grade: "again" | "good"): Promise<ActionState> {
  try {
    const card = await prisma.flashcard.findUnique({ where: { id } });
    if (!card) return { ok: false, error: "Картку не знайдено." };
    if (grade === "again") {
      await prisma.flashcard.update({ where: { id }, data: { intervalDays: 1, dueKey: addDateKeys(dateKey(), 1), lapses: { increment: 1 } } });
      if (card.topicId) {
        await prisma.topic.update({ where: { id: card.topicId }, data: { status: "NEEDS_REVIEW" } });
      }
    } else {
      const interval = Math.max(1, Math.round((card.intervalDays || 1) * card.ease));
      await prisma.flashcard.update({ where: { id }, data: { intervalDays: interval, dueKey: addDateKeys(dateKey(), interval), reps: { increment: 1 } } });
      await addXp(5, "Картка");
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveFlashcard(input: { subjectId?: string; topicId?: string; kind: string; front: string; back: string }): Promise<ActionState> {
  try {
    if (!input.front.trim() || !input.back.trim()) return { ok: false, error: "Заповніть обидва боки картки." };
    await prisma.flashcard.create({
      data: {
        subjectId: input.subjectId || null,
        topicId: input.topicId || null,
        kind: input.kind,
        front: input.front.trim(),
        back: input.back.trim(),
        dueKey: dateKey(),
      },
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setMistakeMeta(id: string, category: string, status: string): Promise<ActionState> {
  try {
    await prisma.mistake.update({ where: { id }, data: { category, status } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function savePreferences(raw: unknown): Promise<ActionState> {
  try {
    const data = preferencesSchema.parse(raw);
    await prisma.userSettings.update({
      where: { id: (await getSettings()).id },
      data: {
        theme: data.theme,
        examDate: data.examDate ? noonUtc(data.examDate) : null,
        targetScore: data.targetScore,
        masteryHighMin: data.masteryHighMin,
        masteryMidMin: data.masteryMidMin,
        timerEnabled: data.timerEnabled,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        mathPriority: data.mathPriority,
        ukrainianPriority: data.ukrainianPriority,
        historyPriority: data.historyPriority,
        biologyPriority: data.biologyPriority,
      },
    });
    refresh();
    return { ok: true, message: "Налаштування збережено." };
  } catch (error) {
    return fail(error);
  }
}

export async function saveSchedule(rawJson: string): Promise<ActionState> {
  try {
    const parsed = JSON.parse(rawJson) as ScheduleConfig;
    if (!parsed.days || !parsed.rotation || !parsed.anchorMockDate) return { ok: false, error: "У розкладі бракує днів, ротації або дати першого пробника." };
    await prisma.userSettings.update({ where: { id: (await getSettings()).id }, data: { scheduleJson: JSON.stringify(parsed) } });
    refresh();
    return { ok: true, message: "Розклад збережено. Перерахуйте майбутній план на сторінці календаря." };
  } catch (error) {
    return fail(error);
  }
}

export async function saveFormat(rawJson: string): Promise<ActionState> {
  try {
    const parsed = JSON.parse(rawJson) as typeof DEFAULT_FORMAT;
    if (typeof parsed.officialFormatConfirmed !== "boolean" || typeof parsed.year !== "number") {
      return { ok: false, error: "Формат має містити year і officialFormatConfirmed." };
    }
    await prisma.userSettings.update({ where: { id: (await getSettings()).id }, data: { formatJson: JSON.stringify({ ...DEFAULT_FORMAT, ...parsed }) } });
    refresh();
    return { ok: true, message: "Конфігурацію формату збережено. Без підтвердженої таблиці рейтинговий бал не обчислюється." };
  } catch (error) {
    return fail(error);
  }
}

export async function saveSecretSettings(input: { openaiApiKey?: string; geminiApiKey?: string; ollamaBaseUrl?: string; youtubeApiKey?: string; clearOpenai?: boolean; clearGemini?: boolean; clearYoutube?: boolean }): Promise<ActionState> {
  try {
    const current = readSecrets();
    const keepOrReplace = (next: string | undefined, clear: boolean | undefined, previous: string | undefined) => {
      if (clear) return "";
      const value = next?.trim();
      return value ? value : previous;
    };
    writeSecrets({
      openaiApiKey: keepOrReplace(input.openaiApiKey, input.clearOpenai, current.openaiApiKey),
      geminiApiKey: keepOrReplace(input.geminiApiKey, input.clearGemini, current.geminiApiKey),
      ollamaBaseUrl: input.ollamaBaseUrl?.trim() || current.ollamaBaseUrl,
      youtubeApiKey: keepOrReplace(input.youtubeApiKey, input.clearYoutube, current.youtubeApiKey),
    });
    return { ok: true, message: "Ключі збережено лише на сервері, у data/secrets.json. Файл не входить до Git." };
  } catch (error) {
    return fail(error);
  }
}

export async function enableLocalTutor(): Promise<ActionState> {
  try {
    const user = await actor();
    const secrets = readSecrets();
    const probe = await probeOllama(secrets.ollamaBaseUrl);
    if (!probe.ok || !probe.preferred) return { ok: false, error: probe.reason || "Локальна модель не знайдена." };
    await prisma.userSettings.update({ where: { id: (await getSettings(user.id)).id }, data: { aiProvider: "ollama", aiModel: probe.preferred } });
    refresh();
    return { ok: true, message: `Локальну модель ${probe.preferred} увімкнено. Запити залишаються на цьому комп'ютері.` };
  } catch (error) {
    return fail(error);
  }
}

export async function askTutor(input: { mode: string; subjectId?: string; topicId?: string; prompt: string }) {
  try {
    const user = await actor();
    const settings = await getSettings(user.id);
    const secrets = readSecrets();
    const provider = settings.aiProvider as "none" | "openai" | "gemini" | "ollama";
    if (provider === "none") return { ok: false as const, error: "AI-репетитор вимкнено. Усі інші розділи працюють без ключа." };
    const topic = input.topicId ? await prisma.topic.findUnique({ where: { id: input.topicId } }) : null;
    const openMistakes = await prisma.mistake.findMany({ where: { userId: user.id, status: { not: "FIXED" }, topicId: { not: null } }, select: { topicId: true } });
    const mistakeCounts = new Map<string, number>();
    for (const mistake of openMistakes) mistakeCounts.set(mistake.topicId!, (mistakeCounts.get(mistake.topicId!) ?? 0) + 1);
    const weakIds = [...mistakeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const weakTopics = await prisma.topic.findMany({ where: { id: { in: weakIds } } });
    const system = [
      "Ти репетитор НМТ. Відповідай простою українською.",
      "Якщо режим unclear: назви незрозумілий крок, поясни іншими словами, дай інший приклад і коротке питання для перевірки. Не вигадуй правильну відповідь, якщо її не можна перевірити.",
      "Не вигадуй офіційні джерела, номери бланків і таблиці переведення балів.",
      "Якщо чогось не знаєш, так і скажи.",
      "Для режиму домашнього завдання поверни лише JSON {\"questions\":[12 об'єктів]} з полями type, difficulty, prompt, explanation, correctAnswer, options.",
      "Розподіл: 4 EASY, 5 MEDIUM, 3 HARD. Типи: SINGLE_CHOICE, MATCHING, SEQUENCE, NUMERIC, SHORT_TEXT, STEP_BY_STEP.",
      "Познач у поясненні, що завдання згенероване і потребує перевірки людиною.",
    ].join(" ");
    const messages: AIMessage[] = [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          `Режим: ${input.mode}.`,
          topic ? `Тема: ${topic.title}. ${topic.summary}` : "",
          weakTopics.length ? `Слабкі теми за журналом: ${weakTopics.map((item) => item.title).join(", ")}.` : "",
          input.prompt,
        ].filter(Boolean).join("\n"),
      },
    ];
    const text = await completeAI({
      provider,
      model: settings.aiModel,
      openaiApiKey: secrets.openaiApiKey,
      geminiApiKey: secrets.geminiApiKey,
      ollamaBaseUrl: secrets.ollamaBaseUrl,
    }, messages);
    const conversation = await prisma.aIConversation.create({ data: { userId: user.id, mode: input.mode, provider, model: settings.aiModel, messagesJson: JSON.stringify([...messages, { role: "assistant", content: text }]) } });
    await prisma.aIMessage.createMany({ data: [...messages, { role: "assistant", content: text }].map((message) => ({ conversationId: conversation.id, role: message.role, content: message.content })) });
    let drafts = null as z.infer<typeof aiPackSchema> | null;
    if (input.mode === "homework" || input.mode === "mini") {
      const parsed = aiPackSchema.safeParse(extractJson(text));
      if (!parsed.success) return { ok: true as const, text, warning: "Відповідь отримано, але JSON завдань не пройшов перевірку структури. У банк нічого не додано." };
      const invalidNumeric = parsed.data.questions.filter((question) => (question.type === "NUMERIC" || question.type === "STEP_BY_STEP") && parseNumber(question.correctAnswer) === null && question.type === "NUMERIC");
      if (invalidNumeric.length) return { ok: true as const, text, warning: "Числові відповіді моделі не пройшли програмну перевірку. Чернетки не збережено." };
      drafts = parsed.data;
    }
    refresh();
    return { ok: true as const, text, drafts };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Помилка AI." };
  }
}

export async function saveGeneratedQuestions(raw: unknown, subjectId: string, topicId: string): Promise<ActionState> {
  try {
    const pack = aiPackSchema.parse(raw);
    for (const question of pack.questions) {
      await prisma.question.create({
        data: {
          subjectId,
          topicId,
          type: question.type,
          difficulty: question.difficulty,
          prompt: question.prompt,
          explanation: question.explanation,
          correctAnswer: question.correctAnswer,
          source: "Згенеровано AI. Потребує перевірки. Не є офіційним завданням НМТ.",
          verificationStatus: "DRAFT",
          generatedByAi: true,
          options: {
            create: question.options.map((option, index) => ({ label: option.label, text: option.text, matchKey: option.matchKey, sortOrder: index })),
          },
        },
      });
    }
    refresh();
    return { ok: true, message: "Чернетки збережено. Вони не потрапляють у тести, доки ви не позначите їх перевіреними." };
  } catch (error) {
    return fail(error);
  }
}

export async function buildBackup() {
  const [settings, subjects, topics, dependencies, videos, notes, questions, options, tests, testQuestions, attempts, answers, examResults, sessions, tasks, reviews, mistakes, flashcards, conversations, achievements, xp] = await Promise.all([
    prisma.userSettings.findMany(),
    prisma.subject.findMany(),
    prisma.topic.findMany(),
    prisma.topicDependency.findMany(),
    prisma.videoLesson.findMany(),
    prisma.note.findMany(),
    prisma.question.findMany(),
    prisma.questionOption.findMany(),
    prisma.test.findMany(),
    prisma.testQuestion.findMany(),
    prisma.testAttempt.findMany(),
    prisma.answer.findMany(),
    prisma.examResult.findMany(),
    prisma.studySession.findMany(),
    prisma.studyTask.findMany(),
    prisma.reviewSchedule.findMany(),
    prisma.mistake.findMany(),
    prisma.flashcard.findMany(),
    prisma.aIConversation.findMany(),
    prisma.achievement.findMany(),
    prisma.xpEvent.findMany(),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), settings, subjects, topics, dependencies, videos, notes, questions, options, tests, testQuestions, attempts, answers, examResults, sessions, tasks, reviews, mistakes, flashcards, conversations, achievements, xp };
}

export async function restoreBackup(rawJson: string, confirmation?: string): Promise<ActionState> {
  try {
    if (confirmation !== "ВІДНОВИТИ") return { ok: false, error: "Відновлення скасовано. Введіть ВІДНОВИТИ." };
    const data = JSON.parse(rawJson) as Awaited<ReturnType<typeof buildBackup>>;
    if (data.version !== 1 || !Array.isArray(data.subjects) || !Array.isArray(data.settings)) return { ok: false, error: "Файл резервної копії не підходить." };
    await prisma.$transaction(async (tx) => {
      await tx.answer.deleteMany();
      await tx.testQuestion.deleteMany();
      await tx.testAttempt.deleteMany();
      await tx.test.deleteMany();
      await tx.mistake.deleteMany();
      await tx.reviewSchedule.deleteMany();
      await tx.studyTask.deleteMany();
      await tx.studySession.deleteMany();
      await tx.videoLesson.deleteMany();
      await tx.note.deleteMany();
      await tx.questionOption.deleteMany();
      await tx.question.deleteMany();
      await tx.flashcard.deleteMany();
      await tx.xpEvent.deleteMany();
      await tx.aIConversation.deleteMany();
      await tx.examResult.deleteMany();
      await tx.topicDependency.deleteMany();
      await tx.topic.deleteMany();
      await tx.achievement.deleteMany();
      await tx.subject.deleteMany();
      await tx.userSettings.deleteMany();
      if (data.subjects.length) await tx.subject.createMany({ data: data.subjects });
      if (data.settings.length) await tx.userSettings.createMany({ data: data.settings });
      if (data.topics.length) await tx.topic.createMany({ data: data.topics });
      if (data.dependencies.length) await tx.topicDependency.createMany({ data: data.dependencies });
      if (data.questions.length) await tx.question.createMany({ data: data.questions });
      if (data.options.length) await tx.questionOption.createMany({ data: data.options });
      if (data.notes.length) await tx.note.createMany({ data: data.notes });
      if (data.videos.length) await tx.videoLesson.createMany({ data: data.videos });
      if (data.flashcards.length) await tx.flashcard.createMany({ data: data.flashcards });
      if (data.tests.length) await tx.test.createMany({ data: data.tests });
      if (data.testQuestions.length) await tx.testQuestion.createMany({ data: data.testQuestions });
      if (data.attempts.length) await tx.testAttempt.createMany({ data: data.attempts });
      if (data.answers.length) await tx.answer.createMany({ data: data.answers });
      if (data.examResults.length) await tx.examResult.createMany({ data: data.examResults });
      if (data.sessions.length) await tx.studySession.createMany({ data: data.sessions });
      if (data.tasks.length) await tx.studyTask.createMany({ data: data.tasks });
      if (data.reviews.length) await tx.reviewSchedule.createMany({ data: data.reviews });
      if (data.mistakes.length) await tx.mistake.createMany({ data: data.mistakes });
      if (data.conversations.length) await tx.aIConversation.createMany({ data: data.conversations });
      if (data.achievements.length) await tx.achievement.createMany({ data: data.achievements });
      if (data.xp.length) await tx.xpEvent.createMany({ data: data.xp });
    });
    refresh();
    return { ok: true, message: "Дані відновлено з резервної копії." };
  } catch (error) {
    return fail(error);
  }
}

export async function login(nickname: string, password: string) {
  const user = await prisma.user.findUnique({ where: { nickname: nickname.trim().toLowerCase() } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Невірний нікнейм або пароль." };
  }
  await createSession(user.id);
  redirect(user.onboarded ? "/" : "/onboarding");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function claimOwner() {
  const host = (await headers()).get("host") ?? "";
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) return { ok: false as const, error: "Перший вхід власника доступний лише з цього комп'ютера." };
  const owner = await prisma.user.findUnique({ where: { id: "owner" } });
  if (!owner || owner.passwordHash) return { ok: false as const, error: "Профіль власника вже захищено паролем." };
  await createSession(owner.id);
  redirect("/onboarding");
}

export async function completeOnboarding(input: {
  firstName: string;
  lastName: string;
  nickname: string;
  password: string;
  examYear: number;
  targetScore: number;
  electiveId: string;
  intensity: "light" | "standard" | "intense";
  dailyMinutes: number;
  preferredTime: string;
  studyDays: number[];
}) {
  if (input.firstName.trim().length < 2) return { ok: false as const, error: "Вкажіть ім'я." };
  if (!/^[a-z0-9_-]{3,24}$/i.test(input.nickname.trim())) return { ok: false as const, error: "Нікнейм: 3–24 латинські літери, цифри, _ або -." };
  if (input.password.length < 8) return { ok: false as const, error: "Пароль має містити щонайменше 8 символів." };
  if (!ELECTIVE_SUBJECT_IDS.includes(input.electiveId as never)) return { ok: false as const, error: "Оберіть один предмет на вибір." };
  const nickname = input.nickname.trim().toLowerCase();
  let existing = await getSessionUser();
  if (existing?.onboarded) {
    await clearSession();
    existing = null;
  }
  const user = existing ?? await prisma.user.create({ data: { firstName: input.firstName.trim(), nickname, passwordHash: hashPassword(input.password), examYear: input.examYear, lastName: input.lastName.trim() } });
  const taken = await prisma.user.findUnique({ where: { nickname } });
  if (taken && taken.id !== user.id) return { ok: false as const, error: "Такий нікнейм уже зайнятий." };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      nickname,
      examYear: input.examYear,
      onboarded: true,
      passwordHash: user.passwordHash && existing ? user.passwordHash : hashPassword(input.password),
    },
  });
  if (!existing || !existing.passwordHash) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(input.password) } });
  }
  const schedule = personalSchedule(input.electiveId, input.intensity);
  const settingsId = user.id === "owner" ? "default" : user.id;
  await prisma.userSettings.upsert({
    where: { id: settingsId },
    update: {
      userId: user.id,
      targetScore: input.targetScore,
      dailyMinutes: input.dailyMinutes,
      intensity: input.intensity,
      preferredTime: input.preferredTime,
      studyDaysJson: JSON.stringify(input.studyDays),
      scheduleJson: JSON.stringify(schedule),
    },
    create: {
      id: settingsId,
      userId: user.id,
      targetScore: input.targetScore,
      dailyMinutes: input.dailyMinutes,
      intensity: input.intensity,
      preferredTime: input.preferredTime,
      studyDaysJson: JSON.stringify(input.studyDays),
      scheduleJson: JSON.stringify(schedule),
      formatJson: JSON.stringify(DEFAULT_FORMAT),
    },
  });
  await prisma.userSubject.deleteMany({ where: { userId: user.id } });
  await prisma.userSubject.createMany({
    data: [
      ...REQUIRED_SUBJECT_IDS.map((subjectId) => ({ userId: user.id, subjectId, role: "REQUIRED", active: true })),
      { userId: user.id, subjectId: input.electiveId, role: "ELECTIVE", active: true },
    ],
  });
  if (!existing) await createSession(user.id);
  redirect("/");
}

export async function changeElective(subjectId: string, confirmed: boolean): Promise<ActionState> {
  try {
    const user = await actor();
    if (!confirmed) return { ok: false, error: "Підтвердьте зміну предмета." };
    if (!ELECTIVE_SUBJECT_IDS.includes(subjectId as never)) return { ok: false, error: "Це не предмет на вибір." };
    const current = user.subjects.find((item) => item.role === "ELECTIVE" && item.active);
    if (current?.subjectId === subjectId) return { ok: true, message: "Цей предмет уже обрано." };
    const today = dateKey();
    if (current) {
      await prisma.studyTask.updateMany({
        where: { userId: user.id, subjectId: current.subjectId, status: "PLANNED", dateKey: { gte: today } },
        data: { status: "DROPPED", notes: "Предмет на вибір змінено. Завершені заняття збережено." },
      });
      await prisma.userSubject.update({ where: { id: current.id }, data: { active: false } });
    }
    await prisma.userSubject.upsert({
      where: { userId_subjectId: { userId: user.id, subjectId } },
      update: { active: true, role: "ELECTIVE" },
      create: { userId: user.id, subjectId, role: "ELECTIVE", active: true },
    });
    const settings = await getSettings(user.id);
    const schedule = personalSchedule(subjectId, settings.intensity === "light" || settings.intensity === "intense" ? settings.intensity : "standard");
    await prisma.userSettings.update({ where: { userId: user.id }, data: { scheduleJson: JSON.stringify(schedule) } });
    await syncPlan(user.id);
    refresh();
    return { ok: true, message: "Предмет на вибір змінено. Минулі результати залишились в історії." };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTopic(input: { id: string; title: string; summary: string; formulas: string; status: string }): Promise<ActionState> {
  try {
    if (!input.title.trim()) return { ok: false, error: "Вкажіть назву теми." };
    if (!["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVIEW", "MASTERED"].includes(input.status)) return { ok: false, error: "Невідомий статус." };
    const user = await actor();
    await prisma.topic.update({
      where: { id: input.id },
      data: { title: input.title.trim(), summary: input.summary, formulas: input.formulas },
    });
    await prisma.userTopicProgress.upsert({
      where: { userId_topicId: { userId: user.id, topicId: input.id } },
      update: { status: input.status },
      create: { userId: user.id, topicId: input.id, status: input.status },
    });
    refresh();
    return { ok: true, message: "Тему оновлено." };
  } catch (error) {
    return fail(error);
  }
}

export async function createTopic(input: { subjectId: string; parentId?: string; title: string; summary: string }): Promise<ActionState> {
  try {
    if (!input.title.trim()) return { ok: false, error: "Вкажіть назву теми." };
    const siblings = await prisma.topic.findMany({ where: { subjectId: input.subjectId }, select: { sortOrder: true } });
    const sortOrder = Math.max(0, ...siblings.map((item) => item.sortOrder)) + 1;
    const topic = await prisma.topic.create({
      data: {
        id: randomUUID(),
        subjectId: input.subjectId,
        parentId: input.parentId || null,
        title: input.title.trim(),
        summary: input.summary.trim(),
        sortOrder,
      },
    });
    refresh();
    return { ok: true, id: topic.id };
  } catch (error) {
    return fail(error);
  }
}

export async function resetScheduleToDefault(): Promise<ActionState> {
  try {
    await prisma.userSettings.update({ where: { id: (await getSettings()).id }, data: { scheduleJson: JSON.stringify(DEFAULT_SCHEDULE) } });
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
