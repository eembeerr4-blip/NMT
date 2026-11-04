import { z } from "zod";
import { exampleAnswerCheckSchema } from "./example-answer";
import { SUBJECTS } from "./constants";
import { UserError } from "./errors";
import { CONTENT_PACKAGE_LIMITS } from "./content-package-limits";
import { prepareQuestion } from "./question-input";
import { parseYouTubeId, youtubeWatchUrl } from "./youtube";

const codeSchema = z.string().trim().min(2, "Код закороткий.").max(64, "Код довший за 64 символи.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Код може містити лише малі латинські літери, цифри та дефіс.");
const line = z.string().trim().min(1).max(1000);
const lines = z.array(line).max(30).default([]);

const lessonSchema = z.object({
  objectives: lines,
  prerequisites: lines,
  theory: z.string().trim().min(50, "Пояснення уроку має містити щонайменше 50 символів.").max(50000, "Пояснення уроку надто довге."),
  rules: lines,
  examples: z.array(z.object({
    task: z.string().trim().min(1).max(3000),
    solution: z.string().trim().min(1).max(5000),
    answerCheck: exampleAnswerCheckSchema.optional(),
  })).max(20).default([]),
  mistakes: lines,
  summary: z.string().trim().max(3000).default(""),
  notes: z.string().trim().max(5000).default(""),
  sources: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    url: z.string().trim().url("Джерело має бути коректним URL.").refine((url) => url.startsWith("https://"), "Джерело має використовувати https://"),
  })).max(10).default([]),
});

const questionSchema = z.object({
  code: codeSchema,
  topicCode: z.string().trim().max(64).optional(),
  type: z.enum(["SINGLE_CHOICE", "MATCHING", "SEQUENCE", "NUMERIC", "SHORT_TEXT", "STEP_BY_STEP"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  prompt: z.string().trim().min(5, "Умова завдання надто коротка.").max(8000, "Умова завдання надто довга."),
  explanation: z.string().trim().min(1, "Додайте пояснення відповіді.").max(8000),
  correctAnswer: z.string().trim().min(1, "Вкажіть правильну відповідь.").max(4000),
  source: z.string().trim().max(300).default(""),
  options: z.array(z.object({
    label: z.string().trim().min(1).max(20),
    text: z.string().trim().min(1).max(2000),
    matchKey: z.enum(["left", "right"]).optional(),
  })).max(12).default([]),
});

const topicSchema = z.object({
  code: codeSchema,
  title: z.string().trim().min(2, "Вкажіть назву теми.").max(200),
  summary: z.string().trim().max(2000).default(""),
  formulas: z.string().trim().max(5000).default(""),
  estimatedMin: z.number().int().min(5).max(180).default(25),
  lesson: lessonSchema,
  video: z.object({
    url: z.string().trim().min(1, "Вкажіть посилання YouTube або приберіть об’єкт video."),
    title: z.string().trim().max(200).default(""),
  }).optional(),
  questions: z.array(questionSchema).max(CONTENT_PACKAGE_LIMITS.maxQuestionsPerTopic).default([]),
});

const sectionSchema = z.object({
  code: codeSchema,
  title: z.string().trim().min(2, "Вкажіть назву розділу.").max(200),
  summary: z.string().trim().max(2000).default(""),
  topics: z.array(topicSchema).min(1, "У розділі має бути хоча б одна тема.").max(CONTENT_PACKAGE_LIMITS.maxTopics),
});

const provenanceSchema = z.object({
  origin: z.enum(["original", "permitted"], { error: "Походження має бути original або permitted." }),
  title: z.string().trim().min(1, "Вкажіть назву джерела.").max(200),
  license: z.string().trim().min(1, "Вкажіть ліцензію або підставу дозволу.").max(120),
  note: z.string().trim().max(500).default(""),
});

export const contentPackageSchema = z.object({
  format: z.literal(CONTENT_PACKAGE_LIMITS.format),
  version: z.literal(CONTENT_PACKAGE_LIMITS.version),
  subjectId: z.enum(SUBJECTS.map((subject) => subject.id)),
  provenance: provenanceSchema,
  sections: z.array(sectionSchema).min(1, "Пакет не містить розділів.").max(CONTENT_PACKAGE_LIMITS.maxSections),
}).superRefine((value, ctx) => {
  const topicCount = value.sections.reduce((sum, section) => sum + section.topics.length, 0);
  const questionCount = value.sections.reduce((sum, section) => sum + section.topics.reduce((inner, topic) => inner + topic.questions.length, 0), 0);
  if (topicCount > CONTENT_PACKAGE_LIMITS.maxTopics) ctx.addIssue({ code: "custom", message: `У пакеті може бути не більше ${CONTENT_PACKAGE_LIMITS.maxTopics} тем. Розділіть матеріал на кілька пакетів.`, path: ["sections"] });
  if (topicCount < 1) ctx.addIssue({ code: "custom", message: "Пакет не містить тем.", path: ["sections"] });
  if (questionCount > CONTENT_PACKAGE_LIMITS.maxQuestions) ctx.addIssue({ code: "custom", message: `У пакеті може бути не більше ${CONTENT_PACKAGE_LIMITS.maxQuestions} завдань.`, path: ["sections"] });
});

export type ContentPackage = z.infer<typeof contentPackageSchema>;

export type TopicSnapshot = {
  id: string;
  subjectId: string;
  parentId: string | null;
  coverage: string;
  lessonJson: string;
};

export type QuestionSnapshot = {
  id: string;
  topicId: string | null;
  subjectId: string;
  prompt: string;
  verificationStatus: string;
  usedInTest: boolean;
};

export type PackageLookup = {
  subject: { id: string; name: string } | null;
  topics: TopicSnapshot[];
  questions: QuestionSnapshot[];
  videos: { topicId: string; youtubeId: string }[];
};

export type PackageIssue = { path: string; message: string };
export type TopicDisposition = "create" | "fill" | "update-draft" | "skip-protected" | "rejected";

export type ContentPackageReport = {
  ok: boolean;
  format: string;
  version: number;
  subjectId: string;
  subjectName: string;
  errors: PackageIssue[];
  warnings: PackageIssue[];
  sections: { code: string; title: string; disposition: "create" | "existing" }[];
  topics: { code: string; title: string; sectionCode: string; disposition: TopicDisposition; questions: number }[];
  questionCount: number;
  videoCount: number;
  counts: {
    sectionsToCreate: number;
    topicsToCreate: number;
    topicsToUpdate: number;
    topicsSkipped: number;
    questionsToCreate: number;
    questionsToUpdate: number;
    questionsSkipped: number;
    videosToAdd: number;
  };
};

export type PlannedQuestion = {
  action: "create" | "update" | "skip";
  id: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  correctAnswer: string;
  source: string;
  options: { id: string; label: string; text: string; sortOrder: number; matchKey?: string }[];
};

export type PlannedTopic = {
  action: "create" | "fill" | "update-draft" | "skip";
  code: string;
  title: string;
  summary: string;
  formulas: string;
  estimatedMin: number;
  lessonJson: string;
  video: { youtubeId: string; url: string; title: string } | null;
  questions: PlannedQuestion[];
};

export type ImportPlan = {
  report: ContentPackageReport;
  subjectId: string;
  sections: { code: string; title: string; summary: string; create: boolean; topics: PlannedTopic[] }[];
};

const zeroCounts = (): ContentPackageReport["counts"] => ({
  sectionsToCreate: 0, topicsToCreate: 0, topicsToUpdate: 0, topicsSkipped: 0,
  questionsToCreate: 0, questionsToUpdate: 0, questionsSkipped: 0, videosToAdd: 0,
});

function blankReport(): ContentPackageReport {
  return {
    ok: false, format: CONTENT_PACKAGE_LIMITS.format, version: CONTENT_PACKAGE_LIMITS.version,
    subjectId: "", subjectName: "", errors: [], warnings: [], sections: [], topics: [],
    questionCount: 0, videoCount: 0, counts: zeroCounts(),
  };
}

function issuePath(path: PropertyKey[]) {
  return path.map(String).join(".");
}

export function packageCodes(pkg: ContentPackage) {
  const sectionCodes = pkg.sections.map((section) => section.code);
  const topicCodes = pkg.sections.flatMap((section) => section.topics.map((topic) => topic.code));
  const questionCodes = pkg.sections.flatMap((section) => section.topics.flatMap((topic) => topic.questions.map((question) => question.code)));
  const prompts = pkg.sections.flatMap((section) => section.topics.flatMap((topic) => topic.questions.map((question) => question.prompt)));
  return { sectionCodes, topicCodes, questionCodes, prompts, allTopicIds: [...new Set([...sectionCodes, ...topicCodes])] };
}

export function parseContentPackage(raw: string): { package?: ContentPackage; report: ContentPackageReport } {
  const report = blankReport();
  if (typeof raw !== "string" || !raw.trim()) {
    report.errors.push({ path: "", message: "Файл порожній." });
    return { report };
  }
  if (Buffer.byteLength(raw, "utf8") > CONTENT_PACKAGE_LIMITS.maxBytes) {
    report.errors.push({ path: "", message: "Файл завеликий. Максимум 2 МБ. Розділіть матеріал на кілька пакетів." });
    return { report };
  }
  let json: unknown;
  try { json = JSON.parse(raw); } catch {
    report.errors.push({ path: "", message: "Файл не є коректним JSON." });
    return { report };
  }
  const parsed = contentPackageSchema.safeParse(json);
  if (!parsed.success) {
    report.errors.push(...parsed.error.issues.slice(0, 12).map((issue) => ({ path: issuePath(issue.path), message: issue.message || "Перевірте поле." })));
    return { report };
  }
  report.subjectId = parsed.data.subjectId;
  report.subjectName = SUBJECTS.find((subject) => subject.id === parsed.data.subjectId)?.name ?? parsed.data.subjectId;
  return { package: parsed.data, report };
}

function protectedTopic(topic: TopicSnapshot) {
  if (topic.coverage === "DRAFT") return false;
  if (topic.lessonJson.trim()) return true;
  return topic.coverage === "READY" || topic.coverage === "VERIFIED" || topic.coverage === "PARTIAL";
}

export function planContentPackage(pkg: ContentPackage, lookup: PackageLookup): ImportPlan {
  const report = blankReport();
  report.subjectId = pkg.subjectId;
  report.subjectName = lookup.subject?.name || SUBJECTS.find((subject) => subject.id === pkg.subjectId)?.name || pkg.subjectId;
  const errors = report.errors;
  const warnings = report.warnings;
  if (!lookup.subject || lookup.subject.id !== pkg.subjectId) errors.push({ path: "subjectId", message: "Предмет не знайдено в базі. Імпорт не створює нові предмети." });

  const topicsById = new Map(lookup.topics.map((topic) => [topic.id, topic]));
  const questionsById = new Map(lookup.questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const questionSeen = new Set<string>();
  const promptSeen = new Set<string>();
  const sections: ImportPlan["sections"] = [];

  for (const [sectionIndex, section] of pkg.sections.entries()) {
    const sectionPath = `sections.${sectionIndex}`;
    if (seen.has(section.code)) errors.push({ path: `${sectionPath}.code`, message: "Код розділу повторено в цьому пакеті." });
    seen.add(section.code);
    const existingSection = topicsById.get(section.code);
    if (existingSection && existingSection.subjectId !== pkg.subjectId) errors.push({ path: `${sectionPath}.code`, message: "Цей код уже належить іншому предмету." });
    if (existingSection && protectedTopic(existingSection)) errors.push({ path: `${sectionPath}.code`, message: "Код розділу збігається з уже наповненим уроком. Оберіть інший код розділу." });
    const createSection = !existingSection;
    report.sections.push({ code: section.code, title: section.title, disposition: createSection ? "create" : "existing" });
    if (!createSection) warnings.push({ path: sectionPath, message: "Розділ уже існує. Його назву та опис не змінено." });
    const plannedTopics: PlannedTopic[] = [];

    for (const [topicIndex, topic] of section.topics.entries()) {
      const topicPath = `${sectionPath}.topics.${topicIndex}`;
      let disposition: TopicDisposition = "create";
      if (seen.has(topic.code)) {
        errors.push({ path: `${topicPath}.code`, message: "Код теми повторено в цьому пакеті." });
        disposition = "rejected";
      }
      seen.add(topic.code);
      const existing = topicsById.get(topic.code);
      if (existing && existing.subjectId !== pkg.subjectId) {
        errors.push({ path: `${topicPath}.code`, message: "Цей код уже належить іншому предмету." });
        disposition = "rejected";
      } else if (existing && protectedTopic(existing)) {
        disposition = "skip-protected";
        warnings.push({ path: topicPath, message: "Тема вже має матеріал і не є чернеткою. Її не перезаписано." });
      } else if (existing?.coverage === "DRAFT") disposition = "update-draft";
      else if (existing) disposition = "fill";

      let video: PlannedTopic["video"] = null;
      if (topic.video && disposition !== "skip-protected" && disposition !== "rejected") {
        const youtubeId = parseYouTubeId(topic.video.url);
        if (!youtubeId) errors.push({ path: `${topicPath}.video.url`, message: "Дозволені лише посилання YouTube: watch, youtu.be, Shorts або embed через https." });
        else if (lookup.videos.some((item) => item.topicId === topic.code && item.youtubeId === youtubeId)) {
          warnings.push({ path: `${topicPath}.video`, message: "Це відео вже додано до теми. Повторно його не створено." });
        } else video = { youtubeId, url: youtubeWatchUrl(youtubeId), title: topic.video.title || topic.title };
      }

      const questions: PlannedQuestion[] = [];
      if (disposition !== "skip-protected" && disposition !== "rejected") {
        for (const [questionIndex, question] of topic.questions.entries()) {
          const questionPath = `${topicPath}.questions.${questionIndex}`;
          if (question.topicCode && question.topicCode !== topic.code) {
            errors.push({ path: `${questionPath}.topicCode`, message: "Завдання посилається на тему, якої немає в цьому уроці." });
            continue;
          }
          if (questionSeen.has(question.code)) {
            errors.push({ path: `${questionPath}.code`, message: "Код завдання повторено в цьому пакеті." });
            continue;
          }
          questionSeen.add(question.code);
          const promptKey = `${topic.code}::${question.prompt}`;
          if (promptSeen.has(promptKey)) {
            errors.push({ path: questionPath, message: "Однакове завдання повторено в цій темі." });
            continue;
          }
          promptSeen.add(promptKey);
          const existingQuestion = questionsById.get(question.code);
          if (existingQuestion && (existingQuestion.topicId !== topic.code || existingQuestion.subjectId !== pkg.subjectId)) {
            errors.push({ path: `${questionPath}.code`, message: "Код завдання вже використано в іншій темі." });
            continue;
          }
          const samePrompt = lookup.questions.find((item) => item.topicId === topic.code && item.prompt === question.prompt && item.id !== question.code);
          if (samePrompt) {
            warnings.push({ path: questionPath, message: "Таке завдання вже є в темі. Дублікат пропущено." });
            questions.push({ action: "skip", id: question.code, type: question.type, difficulty: question.difficulty, prompt: question.prompt, explanation: question.explanation, correctAnswer: question.correctAnswer, source: "", options: [] });
            continue;
          }
          try {
            const prepared = prepareQuestion({
              subjectId: pkg.subjectId,
              topicId: topic.code,
              type: question.type,
              difficulty: question.difficulty,
              prompt: question.prompt,
              explanation: question.explanation,
              correctAnswer: question.correctAnswer,
              source: (question.source || `${pkg.provenance.title} · ${pkg.provenance.license}`).slice(0, 300),
              verificationStatus: "DRAFT",
              options: question.options,
            });
            const action = existingQuestion ? (existingQuestion.verificationStatus === "DRAFT" && !existingQuestion.usedInTest ? "update" : "skip") : "create";
            if (action === "skip") warnings.push({ path: questionPath, message: "Наявне завдання не є чернеткою або вже входить до тесту. Його не змінено." });
            questions.push({
              action,
              id: question.code,
              type: prepared.type,
              difficulty: prepared.difficulty,
              prompt: prepared.prompt,
              explanation: prepared.explanation,
              correctAnswer: prepared.correctAnswer,
              source: prepared.source,
              options: prepared.options.map((option) => ({ id: option.id, label: option.label, text: option.text, sortOrder: option.sortOrder, matchKey: option.matchKey })),
            });
          } catch (error) {
            errors.push({ path: questionPath, message: error instanceof UserError ? error.message : "Завдання не пройшло перевірку." });
          }
        }
      }

      report.topics.push({ code: topic.code, title: topic.title, sectionCode: section.code, disposition, questions: topic.questions.length });
      report.questionCount += topic.questions.length;
      if (video && disposition !== "skip-protected" && disposition !== "rejected") report.videoCount += 1;
      const lessonJson = JSON.stringify({
        objectives: topic.lesson.objectives,
        prerequisites: topic.lesson.prerequisites,
        theory: topic.lesson.theory,
        rules: topic.lesson.rules,
        examples: topic.lesson.examples,
        mistakes: topic.lesson.mistakes,
        summary: topic.lesson.summary,
        notes: topic.lesson.notes,
        sources: topic.lesson.sources,
        provenance: pkg.provenance,
      });
      plannedTopics.push({
        action: disposition === "skip-protected" || disposition === "rejected" ? "skip" : disposition,
        code: topic.code,
        title: topic.title,
        summary: topic.summary,
        formulas: topic.formulas,
        estimatedMin: topic.estimatedMin,
        lessonJson,
        video: disposition === "skip-protected" || disposition === "rejected" ? null : video,
        questions: disposition === "skip-protected" || disposition === "rejected" ? [] : questions,
      });
    }
    sections.push({ code: section.code, title: section.title, summary: section.summary, create: createSection && !errors.some((error) => error.path === `${sectionPath}.code`), topics: plannedTopics });
  }

  report.ok = errors.length === 0;
  if (!report.ok) report.counts = zeroCounts();
  else {
    report.counts = {
      sectionsToCreate: sections.filter((section) => section.create).length,
      topicsToCreate: sections.flatMap((section) => section.topics).filter((topic) => topic.action === "create").length,
      topicsToUpdate: sections.flatMap((section) => section.topics).filter((topic) => topic.action === "fill" || topic.action === "update-draft").length,
      topicsSkipped: report.topics.filter((topic) => topic.disposition === "skip-protected").length,
      questionsToCreate: sections.flatMap((section) => section.topics).flatMap((topic) => topic.questions).filter((question) => question.action === "create").length,
      questionsToUpdate: sections.flatMap((section) => section.topics).flatMap((topic) => topic.questions).filter((question) => question.action === "update").length,
      questionsSkipped: sections.flatMap((section) => section.topics).flatMap((topic) => topic.questions).filter((question) => question.action === "skip").length,
      videosToAdd: sections.flatMap((section) => section.topics).filter((topic) => topic.video).length,
    };
  }
  return { report, subjectId: pkg.subjectId, sections };
}

export function inspectContentPackage(raw: string, lookup: PackageLookup): ImportPlan {
  const parsed = parseContentPackage(raw);
  if (!parsed.package) return { report: parsed.report, subjectId: "", sections: [] };
  return planContentPackage(parsed.package, lookup);
}

export function importResultMessage(report: ContentPackageReport) {
  const { counts } = report;
  return `Створено тем: ${counts.topicsToCreate}. Оновлено чернеток: ${counts.topicsToUpdate}. Пропущено тем: ${counts.topicsSkipped}. Завдань створено: ${counts.questionsToCreate}. Завдань оновлено: ${counts.questionsToUpdate}. Завдань пропущено: ${counts.questionsSkipped}. Усе збережено як чернетки і не опубліковано учням.`;
}
