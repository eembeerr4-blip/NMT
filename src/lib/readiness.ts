import { parseLesson } from "./lesson";

/** Learner availability is separate from the editorial completeness checklist. */
export function lessonAccess(topic: {
  lessonJson: string;
  coverage?: string;
  questions?: unknown[];
  videos?: { reviewStatus: string }[];
}) {
  const hidden = topic.coverage === "DRAFT";
  const theory = !hidden && Boolean(parseLesson(topic.lessonJson)?.theory.trim());
  const video = !hidden && Boolean(topic.videos?.some((item) => item.reviewStatus === "CONFIRMED"));
  const practice = !hidden && Boolean(topic.questions?.length);
  return {
    theory,
    video,
    practice,
    available: theory || video || practice,
    label: hidden
      ? "Чернетка не опублікована"
      : theory
        ? "Конспект доступний"
        : video
          ? "Відео доступне"
          : practice
            ? "Практика доступна"
            : "Матеріал готується",
  };
}

type QuestionRow = { difficulty: string; verificationStatus?: string };
type TopicInput = {
  lessonJson: string;
  children?: unknown[];
  questions: QuestionRow[];
  videos: { reviewStatus: string }[];
};

function verifiedPracticeBank(questions: QuestionRow[]) {
  return questions.filter((q) => !q.verificationStatus || q.verificationStatus === "VERIFIED");
}

export function lessonReadiness(topic: TopicInput) {
  const lesson = parseLesson(topic.lessonJson);
  const theory = Boolean(
    lesson &&
      lesson.theory.trim().length >= 600 &&
      lesson.objectives.length &&
      lesson.rules.length &&
      lesson.mistakes.length &&
      lesson.summary.trim(),
  );
  const examples = Boolean(lesson && lesson.examples.length >= 2);
  const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const q of verifiedPracticeBank(topic.questions)) {
    if (q.difficulty in counts) counts[q.difficulty as keyof typeof counts]++;
  }
  const practice = counts.EASY >= 4 && counts.MEDIUM >= 5 && counts.HARD >= 3;
  const video = topic.videos.some((v) => v.reviewStatus === "CONFIRMED");
  const section = Boolean(topic.children?.length);
  const coreComplete = !section && theory && examples && practice;
  return {
    theory,
    examples,
    practice,
    video,
    counts,
    section,
    ready: coreComplete,
    canStudy: !section && Boolean(lesson?.theory.trim()),
    questionCount: topic.questions.length,
  };
}

/** Server-side gate for publishLesson — returns Ukrainian error or null when publish is allowed. */
export function publishReadinessError(readiness: ReturnType<typeof lessonReadiness>): string | null {
  if (readiness.ready) return null;
  if (readiness.section) return "Публікувати можна лише окремий урок, не розділ програми.";
  const missing: string[] = [];
  if (!readiness.theory) missing.push("розгорнута теорія з цілями, правилами, помилками та підсумком");
  if (!readiness.examples) missing.push("щонайменше два приклади");
  if (!readiness.practice) missing.push("перевірена практика 4/5/3 (лише VERIFIED)");
  return `Урок не готовий до публікації: ${missing.join("; ")}.`;
}
