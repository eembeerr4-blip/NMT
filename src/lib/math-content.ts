import fs from "node:fs";
import path from "node:path";
import {z} from "zod";
import {questionSchema} from "./validators";

const check=z.object({expression:z.string().min(1),expected:z.number().finite()});
const lesson=z.object({objectives:z.array(z.string().min(1)).min(1),prerequisites:z.array(z.string()),theory:z.string().min(600),rules:z.array(z.string().min(1)).min(1),examples:z.array(z.object({task:z.string().min(1),solution:z.string().min(1)})).min(2),mistakes:z.array(z.string().min(1)).min(1),summary:z.string().min(1),sources:z.array(z.object({title:z.string(),url:z.string().url()})),reviewStatus:z.literal("DRAFT")});
const draftQuestion=questionSchema.extend({id:z.string().min(1),verificationStatus:z.literal("DRAFT"),generatedByAi:z.literal(true),options:z.array(z.object({label:z.string(),text:z.string(),matchKey:z.string().optional(),numericValue:z.number().finite().optional(),rationale:z.string().optional()})),verification:z.union([z.object({kind:z.literal("numeric"),expression:z.string()}),z.object({kind:z.literal("matching"),expressions:z.record(z.string(),z.string())})])});
export const mathContentSchema=z.object({version:z.literal(1),subjectId:z.literal("math"),status:z.literal("DRAFT"),protectedTopicIds:z.array(z.string()),sources:z.array(z.object({title:z.string(),url:z.string().url()})),authoringCorrections:z.array(z.object({id:z.string(),reason:z.string()})),packs:z.array(z.object({topicId:z.string(),reviewStatus:z.literal("DRAFT"),syllabusYear:z.literal(2026),lesson,exampleChecks:z.array(check),flashcardTemplates:z.array(z.object({front:z.string().min(1),back:z.string().min(1),kind:z.literal("formula"),reviewStatus:z.literal("DRAFT")})),questions:z.array(draftQuestion).min(12)}))});
export type MathContent=z.infer<typeof mathContentSchema>;
export type MathContentQuestion=MathContent["packs"][number]["questions"][number];
export function loadMathContent(file=path.resolve("prisma/content/math-draft-v1.json")){return mathContentSchema.parse(JSON.parse(fs.readFileSync(file,"utf8")));}
