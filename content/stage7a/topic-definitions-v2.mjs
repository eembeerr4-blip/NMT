/**
 * Stage 7A.1 — batch v2 (2×5 NMT subjects) + deferred archive from v1.
 */
import { STAGE7A_TOPICS } from "./topic-definitions.mjs";
import { STAGE7A_V2_NEW_TOPICS } from "./topic-definitions-v2-new.mjs";

export const STAGE7A_V2_KEPT_IDS = [
  "geography-1",
  "geography-2",
  "ukr-lexicology-section-01",
  "bio-cell-sec-01",
  "zcode-biology-molecular-02",
];

export const STAGE7A_DEFERRED_IDS = [
  "geography-3",
  "geography-4",
  "ukrainian-literature-1",
  "chemistry-1",
  "chemistry-2",
];

const REVIEW_PATCHES = {
  "s7a-geography-1-h01": {
    status: "VERIFIED_CANDIDATE",
    evidence: "52,5° сх. д. = 3,5 год сонячного часу східніше Грінвіча (15° = 1 год).",
  },
  "s7a-geography-1-h03": {
    status: "VERIFIED_CANDIDATE",
    evidence: "Після весняного рівнодення до осіннього в Пн. півкулі день довший за ніч.",
  },
  "s7a-ukr-lexicology-section-01-h02": {
    status: "VERIFIED_CANDIDATE",
    evidence: "Неologізм — новотворене або запозичене слово, що входить у мову.",
  },
  "s7a-bio-cell-sec-01-m04": {
    status: "VERIFIED_CANDIDATE",
    evidence: "Лізосоми містять гідролітичні ферменти; у тваринних клітинах — основний «травний» компартмент.",
  },
  "s7a-bio-cell-sec-01-h02": {
    status: "VERIFIED_CANDIDATE",
    evidence: "Центріолі організують веретено поділу; у багатьох рослин їх немає, у тварин — типово є.",
  },
};

function patchTopic(topic) {
  const reviewDecisions = topic.reviewDecisions.map((d) => {
    const patch = REVIEW_PATCHES[d.questionId];
    if (!patch) return d;
    return { ...d, reviewStatus: patch.status, evidence: patch.evidence, finalDecision: patch.status };
  });
  const questions = topic.questions.map((q) => {
    if (q.code === "s7a-bio-cell-sec-01-m04") {
      return {
        ...q,
        prompt: "Лізосоми в тваринних клітинах переважно відповідають за:",
        options: [
          { label: "А", text: "фотосинтез" },
          { label: "Б", text: "синтез білків на рибosomes" },
          { label: "В", text: "зберігання спадкової інформації" },
          { label: "Г", text: "внутрішньоклітинний гідроліз (перетравлення)" },
        ],
        correctAnswer: "Г",
        explanation:
          "Лізосоми містять ферменти, що розщеплюють біополімери; це типова функція в тваринних клітинах (у рослин частину функцій бере на себе вакуоль).",
      };
    }
    if (q.code === "s7a-bio-cell-sec-01-h02") {
      return {
        ...q,
        prompt: "Центріолі типово присутні під час поділу в клітинах:",
        options: [
          { label: "А", text: "лише прокaryотів" },
          { label: "Б", text: "бактерій" },
          { label: "В", text: "багатьох тварин (організація веретена)" },
          { label: "Г", text: "усіх рослин без винятку" },
        ],
        correctAnswer: "В",
        explanation:
          "У тваринних клітинах центріолі беруть участь у формуванні веретена поділу; у більшості рослин центріолі відсутні.",
      };
    }
    return q;
  });
  return { ...topic, questions, reviewDecisions };
}

const keptTopics = STAGE7A_TOPICS.filter((t) => STAGE7A_V2_KEPT_IDS.includes(t.topicId)).map(patchTopic);

export const STAGE7A_V2_TOPICS = [...keptTopics, ...STAGE7A_V2_NEW_TOPICS];

export const STAGE7A_V2_TOPIC_IDS = STAGE7A_V2_TOPICS.map((t) => t.topicId);

export const STAGE7A_DEFERRED_TOPICS = STAGE7A_TOPICS.filter((t) => STAGE7A_DEFERRED_IDS.includes(t.topicId));
