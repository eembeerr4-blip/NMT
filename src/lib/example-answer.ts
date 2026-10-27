import { z } from "zod";

export const exampleAnswerCheckSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("numeric"), value: z.number().finite(), variable: z.string().regex(/^[a-z]$/i).optional() }).strict(),
  z.object({ type: z.literal("no-solution") }).strict(),
]);
export type ExampleAnswerCheck = z.infer<typeof exampleAnswerCheckSchema>;

export function readExampleAnswerCheck(value: unknown): ExampleAnswerCheck | undefined {
  const parsed = exampleAnswerCheckSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Local practice only: never derive a key from the solution or evaluate expressions. */
export function checkExampleAnswer(raw: string, check: ExampleAnswerCheck): boolean {
  let answer = raw.normalize("NFKC").trim().replace(/−/g, "-");
  if (check.type === "no-solution") {
    answer = answer.toLocaleLowerCase("uk-UA").replace(/[’ʼ‘]/g, "'").replace(/\s+/g, " ");
    return ["розв'язків немає", "немає розв'язків", "розв'язків нема", "∅"].includes(answer);
  }
  if (check.variable) answer = answer.replace(new RegExp("^" + check.variable + "\\s*=\\s*", "i"), "");
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(answer)) return false;
  return Number(answer.replace(",", ".")) === check.value;
}
