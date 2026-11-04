/** Ukrainian plural forms: one (1, 21…), few (2–4, 22–24…), many (0, 5–20, 25–30…). */
export function ukPluralForm(count: number): "one" | "few" | "many" {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

export function ukLessonLabel(count: number): string {
  const form = ukPluralForm(count);
  return form === "many" ? "занять" : "заняття";
}

export function ukLessonCount(count: number): string {
  return `${count} ${ukLessonLabel(count)}`;
}

export function ukQuestionCount(count: number): string {
  const form = ukPluralForm(count);
  const label = form === "one" ? "запитання" : form === "few" ? "запитання" : "запитань";
  return `${count} ${label}`;
}
