import { z } from "zod";
import catalog from "./zno-catalog.json";
import { isDateKey } from "./dates";

export const externalSubjects = ["ukrainian", "math", "history", "geography", "biology"] as const;
export type ExternalSubject = typeof externalSubjects[number];
export function externalSubject(value: string): value is ExternalSubject {
  return externalSubjects.includes(value as ExternalSubject);
}
export function safeZnoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "zno.osvita.ua" && url.port === "" &&
      !url.username && !url.password && !url.search && !url.hash && url.pathname !== "/";
  } catch { return false; }
}
export const znoCatalog = catalog;
export function variantsFor(subjectId: string) {
  return catalog.variants.filter(v => v.subjectId === subjectId && safeZnoUrl(v.url));
}
export function nextVariant(subjectId: string, consumed: number[]) {
  return variantsFor(subjectId).find(v => !consumed.includes(v.number));
}
export const practiceScheduleSchema = z.object({
  enabled: z.boolean(), days: z.array(z.number().int().min(0).max(6)).max(7),
  durationMin: z.number().int().min(20).max(180),
}).refine(v => !v.enabled || v.days.length > 0, { message: "Оберіть день тренування." });
export type PracticeSchedule = z.infer<typeof practiceScheduleSchema>;
export function practiceSchedule(schedule: unknown): PracticeSchedule {
  const parsed = practiceScheduleSchema.safeParse((schedule as { externalPractice?: unknown } | null)?.externalPractice);
  return parsed.success ? { ...parsed.data, days: [...new Set(parsed.data.days)].sort() } : { enabled: false, days: [], durationMin: 60 };
}
export const externalResultSchema = z.object({
  assignmentId: z.string().min(1), version: z.number().int().nonnegative(),
  date: z.string().refine(isDateKey, "Вкажіть коректну дату."),
  rawScore: z.number().int().nonnegative().max(1000), maxRawScore: z.number().int().positive().max(1000).nullable(),
  ratingScore: z.number().int().min(100).max(200).nullable(),
  errorCount: z.number().int().nonnegative().max(1000).nullable(), comment: z.string().trim().max(2000),
}).refine(v => v.maxRawScore === null || v.rawScore <= v.maxRawScore, { message: "Бал перевищує максимум." });
export type ExternalResultInput = z.infer<typeof externalResultSchema>;

export const topicCoverageLabels: Record<string,string> = {
  EXACT:"Завдання точно за цією темою", NARROWER:"Завдання охоплюють частину теми",
  BROADER:"Добірка також містить інші теми", OVERLAPPING:"Добірка частково перетинається з матеріалом уроку",
  UNCERTAIN:"Відповідність темі потребує уточнення", MISSING:"Підтвердженої добірки поки немає",
};
export function topicCoverageLabel(coverage:string) { return topicCoverageLabels[coverage] ?? topicCoverageLabels.UNCERTAIN; }
export function variantCatalogMessage(subjectId:string,assignments:{subjectId:string;variantNumber:number;status:string}[]) {
  const variants=variantsFor(subjectId);if(!variants.length)return "Підтверджених варіантів поки немає.";
  const rows=assignments.filter(a=>a.subjectId===subjectId);
  const processed=new Set(rows.filter(a=>["COMPLETED","SKIPPED"].includes(a.status)).map(a=>a.variantNumber));
  if(variants.every(v=>processed.has(v.number)))return "Усі доступні варіанти пройдено або явно пропущено. Нових підтверджених варіантів поки немає.";
  if(rows.some(a=>["PLANNED","PAUSED"].includes(a.status)&&variants.some(v=>v.number===a.variantNumber)))return "Є призначений або незавершений варіант. Відкрийте його картку вище.";
  return rows.length?"Є доступні варіанти для наступного тренування.":"Ви ще не починали ці варіанти.";
}
