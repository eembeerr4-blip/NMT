export const SUBJECTS = [
  { id: "ukrainian", name: "Українська мова", shortName: "Укр. мова", color: "#c47b2b", role: "required", description: "Орфографія, морфологія, синтаксис, пунктуація та робота з текстом." },
  { id: "math", name: "Математика", shortName: "Математика", color: "#4f6df5", role: "required", description: "Алгебра, функції, геометрія та основи аналізу за шкільною програмою." },
  { id: "history", name: "Історія України", shortName: "Історія", color: "#b4534a", role: "required", description: "Від стародавньої історії до незалежної України." },
  { id: "ukrainian-literature", name: "Українська література", shortName: "Література", color: "#a16207", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
  { id: "english", name: "Англійська мова", shortName: "Англійська", color: "#0369a1", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
  { id: "german", name: "Німецька мова", shortName: "Німецька", color: "#b45309", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
  { id: "french", name: "Французька мова", shortName: "Французька", color: "#6d28d9", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
  { id: "spanish", name: "Іспанська мова", shortName: "Іспанська", color: "#be123c", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
  { id: "biology", name: "Біологія", shortName: "Біологія", color: "#2f8f6b", role: "elective", description: "Клітина, організм людини, генетика, еволюція та екологія." },
  { id: "geography", name: "Географія", shortName: "Географія", color: "#0f766e", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
  { id: "physics", name: "Фізика", shortName: "Фізика", color: "#1d4ed8", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
  { id: "chemistry", name: "Хімія", shortName: "Хімія", color: "#7c3aed", role: "elective", description: "Предмет на вибір. Наповнення тем ще не завершене." },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]["id"];

export const REQUIRED_SUBJECT_IDS = SUBJECTS.filter((subject) => subject.role === "required").map((subject) => subject.id);
export const ELECTIVE_SUBJECT_IDS = SUBJECTS.filter((subject) => subject.role === "elective").map((subject) => subject.id);
export const SUBJECT_IDS: SubjectId[] = ["math", "ukrainian", "history", "biology"];

export const COVERAGE_LABEL: Record<string, string> = {
  VERIFIED: "Перевірено",
  NEEDS_REVIEW: "Потребує перевірки",
  PARTIAL: "Потребує перевірки",
  READY: "Перевірено",
  NEEDS_CONTENT: "Немає матеріалів",
};

export const VIDEO_ROLES = [
  { id: "primary", label: "Основна лекція" },
  { id: "simple", label: "Просте пояснення" },
  { id: "examples", label: "Пояснення на прикладах" },
  { id: "tasks", label: "Розбір типових завдань" },
] as const;

export const PLAN_START = "2026-10-19";
export const FIRST_MOCK = "2026-10-24";

export const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Не розпочато",
  IN_PROGRESS: "Вивчається",
  NEEDS_REVIEW: "Потрібне повторення",
  MASTERED: "Засвоєно",
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Просте",
  MEDIUM: "Середнє",
  HARD: "Складне",
};

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: "Одна правильна відповідь",
  MATCHING: "Відповідність",
  SEQUENCE: "Послідовність",
  NUMERIC: "Числова відповідь",
  SHORT_TEXT: "Коротка текстова відповідь",
  STEP_BY_STEP: "Задача з розв'язанням",
};

export const MISTAKE_CATEGORY_LABEL: Record<string, string> = {
  UNKNOWN_TOPIC: "Не знаю тему",
  WRONG_RULE: "Неправильно застосував правило",
  CARELESS: "Неуважність",
  TIME: "Не вистачило часу",
  CALCULATION: "Помилка в обчисленнях",
};

export const EXAM_TYPE_LABEL: Record<string, string> = {
  DIAGNOSTIC: "Діагностика",
  FULL_MOCK: "Повний пробник",
  PARTIAL: "Частковий тест",
  MANUAL: "Інший запис",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Заплановано",
  IN_PROGRESS: "У процесі",
  DONE: "Завершено",
  SKIPPED: "Пропущено",
  MOVED: "Перенесено",
};

export const NAV = [
  { href: "/", label: "Головна" },
  { href: "/subjects", label: "Предмети" },
  { href: "/tests", label: "Тести" },
  { href: "/exams", label: "Пробники" },
  { href: "/results", label: "Результати" },
  { href: "/analytics", label: "Аналітика" },
  { href: "/calendar", label: "Календар" },
  { href: "/mistakes", label: "Помилки" },
  { href: "/review", label: "Повторення" },
  { href: "/notes", label: "Конспекти" },
  { href: "/settings", label: "Налаштування" },
] as const;

export const DEFAULT_FORMAT = {
  year: 2027,
  officialFormatConfirmed: false,
  note: "Офіційний формат і таблиці переведення тестових балів у рейтингові для НМТ-2027 у застосунку не задані. Рейтинговий бал зберігайте лише тоді, коли він відомий з офіційного джерела. Без таблиці сайт показує тестовий бал і не вигадує рейтинговий.",
  scales: {} as Record<string, Record<string, { raw: number; rating: number }[]>>,
};

export const TASK_KINDS = ["study", "mock", "analysis", "rest", "review", "custom"] as const;

export type DaySlot = {
  slot: number;
  subjectId?: SubjectId;
  title: string;
  durationMin: number;
  kind: (typeof TASK_KINDS)[number];
  optional?: boolean;
};

export type ScheduleConfig = {
  anchorMockDate: string;
  rotation: SubjectId[];
  days: Record<string, DaySlot[]>;
};

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  anchorMockDate: FIRST_MOCK,
  rotation: ["math", "ukrainian", "history", "biology"],
  days: {
    "1": [
      { slot: 0, subjectId: "math", title: "Математика", durationMin: 90, kind: "study" },
      { slot: 1, subjectId: "ukrainian", title: "Українська мова", durationMin: 60, kind: "study" },
    ],
    "2": [
      { slot: 0, subjectId: "history", title: "Історія України", durationMin: 75, kind: "study" },
      { slot: 1, subjectId: "biology", title: "Біологія", durationMin: 60, kind: "study" },
    ],
    "3": [
      { slot: 0, subjectId: "math", title: "Математика", durationMin: 90, kind: "study" },
      { slot: 1, subjectId: "ukrainian", title: "Українська мова", durationMin: 60, kind: "study" },
    ],
    "4": [
      { slot: 0, subjectId: "history", title: "Історія України", durationMin: 75, kind: "study" },
      { slot: 1, subjectId: "biology", title: "Біологія", durationMin: 60, kind: "study" },
    ],
    "5": [
      { slot: 0, subjectId: "math", title: "Математика", durationMin: 90, kind: "study" },
      { slot: 1, subjectId: "ukrainian", title: "Українська мова", durationMin: 60, kind: "study" },
    ],
    "6": [
      { slot: 0, title: "Повний пробник", durationMin: 120, kind: "mock" },
      { slot: 1, title: "Аналіз помилок", durationMin: 40, kind: "analysis" },
    ],
    "0": [
      { slot: 0, title: "Відпочинок", durationMin: 0, kind: "rest", optional: true },
      { slot: 1, title: "Коротке повторення", durationMin: 20, kind: "review", optional: true },
    ],
  },
};

export const WEEKDAY_LABELS = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

export const PRACTICE_SOURCE =
  "Авторське тренувальне завдання NMT Academy. Не є офіційним матеріалом НМТ.";

export const AI_MODES = [
  { id: "explain", label: "Поясни тему" },
  { id: "homework", label: "Дай домашнє завдання" },
  { id: "check", label: "Перевір мої відповіді" },
  { id: "mistake", label: "Поясни мою помилку" },
  { id: "mini", label: "Проведи мінііспит" },
  { id: "weak", label: "Повтори слабкі теми" },
  { id: "unclear", label: "Я не зрозумів" },
] as const;
