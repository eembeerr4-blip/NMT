import { lessonAccess } from "./readiness";

// Existing available material only. Candidate packages are not a learner route.
const order = [
  "ukr-lexis", "ukr-lexicology-section-01", "ukr-lex-01-meaning",
  "ukr-lex-02-syn-ant-hom", "ukr-lex-03-phraseology", "ukr-morph",
  "ukr-word", "ukr-phonetics", "ukr-ortho", "ukr-ortho-sub-01",
  "ukr-syntax", "ukr-punct", "ukr-style",
];

export const ukrainianRouteGaps = [
  "Частина доступних тем — короткі огляди. Повного вступу до частин мови та членів речення для навчання з нуля ще немає.",
  "Будову слова розміщено перед фонетикою, а морфологію — перед синтаксисом. Окремих повних уроків словотвору, простих і складних конструкцій поки бракує.",
  "Стилі й аналіз тексту наразі об’єднані в одному короткому огляді. Окремого вступу до стилів перед підсумковою роботою з текстом ще немає.",
];

type RouteTopic = {
  id: string; parentId: string | null; sortOrder: number; lessonJson: string;
  coverage?: string; questions: unknown[]; videos: { reviewStatus: string }[];
};

export function ukrainianLearnerRoute<T extends RouteTopic>(topics: T[]) {
  const rank = (id: string) => order.includes(id) ? order.indexOf(id) : order.length;
  return topics.filter(topic => !topics.some(child => child.parentId === topic.id) && lessonAccess(topic).available)
    .sort((a, b) => rank(a.id) - rank(b.id) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}
