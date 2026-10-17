import { PrismaClient } from "@prisma/client";
import { DEFAULT_FORMAT, DEFAULT_SCHEDULE, SUBJECTS } from "../src/lib/constants";
import { dateKey, noonUtc } from "../src/lib/dates";
import { achievements, dependencies, flashcards, historicalResults, notes, topics } from "./curriculum";
import { lessons } from "./lessons";
import { outlines } from "./outlines";
import { extraQuestions } from "./practice-extra";
import { questionSource, questions } from "./questions";

const prisma = new PrismaClient();

async function main() {
  for (const [index, subject] of SUBJECTS.entries()) {
    await prisma.subject.upsert({
      where: { id: subject.id },
      update: {
        name: subject.name,
        shortName: subject.shortName,
        description: subject.description,
        color: subject.color,
        sortOrder: index,
      },
      create: {
        id: subject.id,
        name: subject.name,
        shortName: subject.shortName,
        description: subject.description,
        color: subject.color,
        sortOrder: index,
      },
    });
  }

  await prisma.userSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      scheduleJson: JSON.stringify(DEFAULT_SCHEDULE),
      formatJson: JSON.stringify(DEFAULT_FORMAT),
    },
  });

  const lessonByTopic = new Map(lessons.map((item) => [item.topicId, item]));
  for (const topic of topics) {
    const lesson = lessonByTopic.get(topic.id);
    const lessonJson = lesson ? JSON.stringify({
      objectives: lesson.objectives,
      theory: lesson.theory,
      rules: lesson.rules,
      examples: lesson.examples,
      mistakes: lesson.mistakes,
      summary: lesson.summary,
    }) : "";
    await prisma.topic.upsert({
      where: { id: topic.id },
      update: {
        title: topic.title,
        summary: topic.summary,
        formulas: topic.formulas ?? "",
        sortOrder: topic.sortOrder,
        parentId: topic.parentId ?? null,
        subjectId: topic.subjectId,
        coverage: lesson ? "VERIFIED" : "NEEDS_REVIEW",
        lessonJson,
        estimatedMin: lesson?.minutes ?? 25,
      },
      create: {
        id: topic.id,
        subjectId: topic.subjectId,
        parentId: topic.parentId ?? null,
        title: topic.title,
        summary: topic.summary,
        formulas: topic.formulas ?? "",
        sortOrder: topic.sortOrder,
        coverage: lesson ? "VERIFIED" : "NEEDS_REVIEW",
        lessonJson,
        estimatedMin: lesson?.minutes ?? 25,
      },
    });
  }

  for (const topic of outlines) {
    await prisma.topic.upsert({
      where: { id: topic.id },
      update: { title: topic.title, summary: topic.summary, sortOrder: topic.sortOrder, coverage: topic.coverage },
      create: { id: topic.id, subjectId: topic.subjectId, title: topic.title, summary: topic.summary, sortOrder: topic.sortOrder, coverage: topic.coverage },
    });
  }

  for (const dependency of dependencies) {
    await prisma.topicDependency.upsert({
      where: { topicId_prerequisiteId: dependency },
      update: {},
      create: dependency,
    });
  }

  for (const question of [...questions, ...extraQuestions]) {
    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        prompt: question.prompt,
        explanation: question.explanation,
        correctAnswer: question.correctAnswer,
        type: question.type,
        difficulty: question.difficulty,
        subtopic: question.subtopic,
        source: questionSource,
        verificationStatus: "VERIFIED",
        generatedByAi: false,
      },
      create: {
        id: question.id,
        subjectId: question.subjectId,
        topicId: question.topicId,
        subtopic: question.subtopic,
        type: question.type,
        difficulty: question.difficulty,
        prompt: question.prompt,
        explanation: question.explanation,
        correctAnswer: question.correctAnswer,
        source: questionSource,
        verificationStatus: "VERIFIED",
        generatedByAi: false,
      },
    });
    await prisma.questionOption.deleteMany({ where: { questionId: question.id } });
    if (question.options.length) {
      await prisma.questionOption.createMany({
        data: question.options.map((option) => ({
          id: option.id,
          questionId: question.id,
          label: option.label,
          text: option.text,
          sortOrder: option.sortOrder,
          matchKey: option.matchKey ?? null,
        })),
      });
    }
  }

  for (const result of historicalResults) {
    await prisma.examResult.upsert({
      where: { id: result.id },
      update: {},
      create: {
        ...result,
        date: noonUtc(result.date),
      },
    });
  }

  for (const note of notes) {
    await prisma.note.upsert({
      where: { id: note.id },
      update: { title: note.title, content: note.content },
      create: note,
    });
  }

  const today = dateKey();
  for (const card of flashcards) {
    await prisma.flashcard.upsert({
      where: { id: card.id },
      update: { front: card.front, back: card.back, kind: card.kind },
      create: { ...card, dueKey: today },
    });
  }

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { id: achievement.id },
      update: { title: achievement.title, description: achievement.description, xp: achievement.xp },
      create: achievement,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
