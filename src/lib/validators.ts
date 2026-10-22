import { z } from "zod";
import { SUBJECTS } from "./constants";

export const subjectIdSchema = z.enum(SUBJECTS.map((subject) => subject.id));

export const examResultSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Вкажіть дату"),
  subjectId: subjectIdSchema,
  testType: z.enum(["DIAGNOSTIC", "FULL_MOCK", "PARTIAL", "MANUAL"]),
  title: z.string().trim().min(1, "Вкажіть назву").max(200),
  source: z.string().trim().max(300),
  rawScore: z.number().int().nonnegative().nullable(),
  maxRawScore: z.number().int().positive().nullable(),
  ratingScore: z.number().int().min(100).max(200).nullable(),
  belowThreshold: z.boolean(),
  partial: z.boolean(),
  countsTowardAverage: z.boolean(),
  durationMin: z.number().int().nonnegative().nullable(),
  errorCount: z.number().int().nonnegative().nullable(),
  comment: z.string().trim().max(2000),
}).refine((value) => value.rawScore === null || value.maxRawScore === null || value.rawScore <= value.maxRawScore, {
  message: "Набраний бал не може перевищувати максимум",
  path: ["rawScore"],
});

export const questionSchema = z.object({
  id: z.string().optional(),
  subjectId: subjectIdSchema,
  topicId: z.string().min(1),
  subtopic: z.string().trim().max(200).default(""),
  type: z.enum(["SINGLE_CHOICE", "MATCHING", "SEQUENCE", "NUMERIC", "SHORT_TEXT", "STEP_BY_STEP"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  prompt: z.string().trim().min(5),
  explanation: z.string().trim().min(1),
  correctAnswer: z.string().trim().min(1),
  source: z.string().trim().max(300).default(""),
  verificationStatus: z.enum(["DRAFT", "PENDING_REVIEW", "VERIFIED", "REJECTED"]),
  options: z.array(z.object({
    id: z.string().optional(),
    label: z.string().trim().min(1),
    text: z.string().trim().min(1),
    matchKey: z.string().nullish().transform(value=>value??undefined),
  })).default([]),
});

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  targetScore: z.number().int().min(100).max(200),
  masteryHighMin: z.number().int().min(1).max(12),
  masteryMidMin: z.number().int().min(0).max(11),
  timerEnabled: z.boolean(),
  mathPriority: z.number().int().min(0).max(100),
  ukrainianPriority: z.number().int().min(0).max(100),
  historyPriority: z.number().int().min(0).max(100),
  biologyPriority: z.number().int().min(0).max(100),
}).refine((value) => value.masteryHighMin > value.masteryMidMin, {
  message: "Поріг засвоєння має бути вищим за поріг закріплення",
  path: ["masteryHighMin"],
}).refine((value) => value.mathPriority + value.ukrainianPriority + value.historyPriority + value.biologyPriority === 100, {
  message: "Пріоритети предметів мають давати 100%",
  path: ["mathPriority"],
});
