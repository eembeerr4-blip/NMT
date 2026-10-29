import type { Prisma } from "@prisma/client";
import {
  packageCodes,
  parseContentPackage,
  planContentPackage,
  type ContentPackage,
  type ImportPlan,
  type PackageLookup,
} from "@/lib/content-package";

export async function loadContentPackageLookup(db: Prisma.TransactionClient, pkg: ContentPackage): Promise<PackageLookup> {
  const codes = packageCodes(pkg);
  const questionOr: Prisma.QuestionWhereInput[] = [];
  if (codes.questionCodes.length) questionOr.push({ id: { in: codes.questionCodes } });
  if (codes.topicCodes.length && codes.prompts.length) {
    questionOr.push({ topicId: { in: codes.topicCodes }, prompt: { in: codes.prompts } });
  }
  const [subject, topics, questions, used, videos] = await Promise.all([
    db.subject.findUnique({ where: { id: pkg.subjectId }, select: { id: true, name: true } }),
    codes.allTopicIds.length
      ? db.topic.findMany({
          where: { id: { in: codes.allTopicIds } },
          select: { id: true, subjectId: true, parentId: true, coverage: true, lessonJson: true },
        })
      : [],
    questionOr.length
      ? db.question.findMany({
          where: { OR: questionOr },
          select: { id: true, topicId: true, subjectId: true, prompt: true, verificationStatus: true },
        })
      : [],
    codes.questionCodes.length
      ? db.testQuestion.findMany({ where: { questionId: { in: codes.questionCodes } }, select: { questionId: true } })
      : [],
    codes.topicCodes.length
      ? db.videoLesson.findMany({ where: { topicId: { in: codes.topicCodes } }, select: { topicId: true, youtubeId: true } })
      : [],
  ]);
  const usedIds = new Set(used.map((item) => item.questionId));
  return {
    subject,
    topics,
    videos,
    questions: questions.map((question) => ({ ...question, usedInTest: usedIds.has(question.id) })),
  };
}

export async function applyContentPlan(tx: Prisma.TransactionClient, plan: ImportPlan) {
  if (!plan.report.ok) return;
  const max = await tx.topic.aggregate({ where: { subjectId: plan.subjectId }, _max: { sortOrder: true } });
  let sortOrder = (max._max.sortOrder ?? 0) + 1;
  for (const section of plan.sections) {
    if (section.create) {
      await tx.topic.create({
        data: {
          id: section.code,
          subjectId: plan.subjectId,
          parentId: null,
          title: section.title,
          summary: section.summary,
          sortOrder: sortOrder++,
          coverage: "NEEDS_CONTENT",
          lessonJson: "",
          status: "NOT_STARTED",
        },
      });
    }
    for (const topic of section.topics) {
      if (topic.action === "skip") continue;
      if (topic.action === "create") {
        await tx.topic.create({
          data: {
            id: topic.code,
            subjectId: plan.subjectId,
            parentId: section.code,
            title: topic.title,
            summary: topic.summary,
            formulas: topic.formulas,
            sortOrder: sortOrder++,
            coverage: "DRAFT",
            lessonJson: topic.lessonJson,
            estimatedMin: topic.estimatedMin,
            status: "NOT_STARTED",
          },
        });
      } else {
        await tx.topic.update({
          where: { id: topic.code },
          data: {
            title: topic.title,
            summary: topic.summary,
            formulas: topic.formulas,
            estimatedMin: topic.estimatedMin,
            lessonJson: topic.lessonJson,
            coverage: "DRAFT",
          },
        });
      }
      if (topic.video) {
        await tx.videoLesson.create({
          data: {
            topicId: topic.code,
            youtubeId: topic.video.youtubeId,
            url: topic.video.url,
            title: topic.video.title,
            reviewStatus: "SUGGESTED",
            isPrimary: false,
            role: "primary",
          },
        });
      }
      for (const question of topic.questions) {
        if (question.action === "skip") continue;
        const data = {
          subjectId: plan.subjectId,
          topicId: topic.code,
          subtopic: "",
          type: question.type,
          difficulty: question.difficulty,
          prompt: question.prompt,
          explanation: question.explanation,
          correctAnswer: question.correctAnswer,
          source: question.source,
          verificationStatus: "DRAFT" as const,
          generatedByAi: true,
        };
        if (question.action === "create") await tx.question.create({ data: { ...data, id: question.id } });
        else {
          await tx.question.update({ where: { id: question.id }, data });
          await tx.questionOption.deleteMany({ where: { questionId: question.id } });
        }
        if (question.options.length) {
          await tx.questionOption.createMany({
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
    }
  }
}

export async function reviewedPlan(raw: string, db: Prisma.TransactionClient) {
  const parsed = parseContentPackage(raw);
  if (!parsed.package) {
    return { plan: null, report: parsed.report, error: parsed.report.errors[0]?.message ?? "Пакет не пройшов перевірку." };
  }
  const plan = planContentPackage(parsed.package, await loadContentPackageLookup(db, parsed.package));
  if (!plan.report.ok) {
    return { plan: null, report: plan.report, error: plan.report.errors[0]?.message ?? "Пакет не пройшов перевірку." };
  }
  return { plan, report: plan.report, error: "" };
}
