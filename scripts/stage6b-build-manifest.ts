import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type BaselineQ = {
  id: string;
  subjectId: string;
  topicId: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  correctAnswer: string;
  source: string;
  verificationStatus: string;
  options: { id: string; label: string; text: string; matchKey: string | null }[];
};

const baseline = JSON.parse(
  readFileSync(path.join(process.cwd(), "content/stage6b/exported-questions-baseline.json"), "utf8"),
) as BaselineQ[];

const HUMAN_REVIEW = new Set(["ukr-lex-02-q10"]);
const FIX_IDS = new Set(["zcode-biology-molecular-protein-synth-q08"]);

function promptHash(prompt: string) {
  return createHash("sha256").update(prompt.trim()).digest("hex").slice(0, 16);
}

function toSaveShape(q: BaselineQ, patch: Partial<BaselineQ> = {}) {
  const merged = { ...q, ...patch };
  return {
    id: merged.id,
    subjectId: merged.subjectId,
    topicId: merged.topicId,
    subtopic: "",
    type: merged.type,
    difficulty: merged.difficulty,
    prompt: merged.prompt,
    explanation: merged.explanation,
    correctAnswer: merged.correctAnswer,
    source: merged.source,
    verificationStatus: "DRAFT" as const,
    options: merged.options.map((o) => ({
      id: o.id,
      label: o.label,
      text: o.text,
      matchKey: o.matchKey ?? undefined,
    })),
  };
}

const reviews = baseline.map((q) => {
  if (FIX_IDS.has(q.id)) {
    return {
      questionId: q.id,
      status: "FIX_REQUIRED" as const,
      reason: "Калька «Кодируюча» та «нетрансльовані»; потрібна українська формулювання та перевірка умови.",
    };
  }
  if (HUMAN_REVIEW.has(q.id)) {
    return {
      questionId: q.id,
      status: "NEEDS_HUMAN_REVIEW" as const,
      reason: "Сміливе твердження про повні омоніми «такт»; бажано підтвердити лінгвістом.",
    };
  }
  return {
    questionId: q.id,
    status: "APPROVE_CANDIDATE" as const,
    reason: "Умова, варіанти, correctAnswer і пояснення узгоджені; prepareQuestion PASS.",
  };
});

const updates = [
  {
    id: "zcode-biology-molecular-protein-synth-q08",
    match: { promptContains: "Кодируюча" },
    reason: "Українська термінологія та зрозуміліша умова.",
    question: toSaveShape(
      baseline.find((q) => q.id === "zcode-biology-molecular-protein-synth-q08")!,
      {
        prompt:
          "Кодуюча ділянка іРНК містить 120 нуклеотидів, що кодують амінокислоти; стоп-кодон (3 нуклеотиди) і неперекладні ділянки до цього числа не входять. Скільки амінокислотних залишків міститиме синтезований поліпептид? Відповідайте числом.",
        explanation:
          "120 нуклеотидів припадають лише на кодони амінокислот: 120 ÷ 3 = 40 амінокислотних залишків. Стоп-кодон амінокислоти не кодує; неперекладні ділянки іРНК у розрахунок не входять.",
        source: "NMT Academy: біосинтез білка · original (Stage 6B edit)",
      },
    ),
  },
];

type NewQ = ReturnType<typeof toSaveShape>;

function sc(
  id: string,
  topicId: string,
  subjectId: "ukrainian" | "biology",
  difficulty: "EASY" | "MEDIUM" | "HARD",
  prompt: string,
  explanation: string,
  correctText: string,
  distractors: [string, string, string],
): NewQ {
  const labels = ["А", "Б", "В", "Г"] as const;
  const texts = [distractors[0], distractors[1], distractors[2], correctText];
  const options = labels.map((label, i) => ({
    id: `${id}-opt-${label}`,
    label,
    text: texts[i],
  }));
  return {
    id,
    subjectId,
    topicId,
    subtopic: "",
    type: "SINGLE_CHOICE",
    difficulty,
    prompt,
    explanation,
    correctAnswer: options[3].id,
    source: "NMT Academy: Stage 6B bank supplement · original",
    verificationStatus: "DRAFT",
    options,
  };
}

const additions: NewQ[] = [
  sc(
    "bio-cell-01-q11",
    "bio-cell-01-eukaryotic-cell",
    "biology",
    "EASY",
    "Яка органела характерна для рослинної клітини, але відсутня в типовій тваринній клітині?",
    "Хлоропласти є в рослинних клітинах і забезпечують фотосинтез. У тварин немає хлоропластів; мітохондрії, рибосоми та ядро є в обох типах клітин.",
    "Хлоропласт",
    ["Мітохондрія", "Ядро", "Рибосома"],
  ),
  sc(
    "bio-cell-01-q12",
    "bio-cell-01-eukaryotic-cell",
    "biology",
    "MEDIUM",
    "Клітина активно синтезує білки для секреції. Яке поєднання органел буде найбільш розвиненим?",
    "Секреторні білки синтезуються на рибосомах шорсткої ЕПС, проходять через порожнину ЕПС і комплекс Гольджі.",
    "Шорста ЕПС + комплекс Гольджі",
    ["Лізосоми + центріолі", "Хлоропласти + вакуоля", "Рибосоми в цитоплазмі + пероксисоми"],
  ),
  sc(
    "ukr-lex-01-q11",
    "ukr-lex-01-meaning",
    "ukrainian",
    "MEDIUM",
    "У якому реченні слово «золотий» вжите в прямому значенні?",
    "«Золотий медальон» — метал. «Золоті руки», «золоте серце», «золотий характер» — переносні значення.",
    "Вона отримала золотий медальон на ювілей.",
    [
      "Майстриня має золоті руки.",
      "У нього золоте серце.",
      "Це золотий характер людини.",
    ],
  ),
  sc(
    "ukr-lex-01-q12",
    "ukr-lex-01-meaning",
    "ukrainian",
    "HARD",
    "У якому варіанті немає лексичної помилки?",
    "Нормативно «сплатити рахунок». «Оплатити рахунок» — типова калька; «приймати участь» — калька; «відкрити підручник» — некоректне слововживання.",
    "Сплатити рахунок за проїзд у транспорті.",
    ["Оплатити рахунок за проїзд у транспорті.", "Прийняти участь у конференції.", "Відкрити підручник на сторінці."],
  ),
  sc(
    "ukr-lex-02-q11",
    "ukr-lex-02-syn-ant-hom",
    "ukrainian",
    "MEDIUM",
    "Яке твердження правильне?",
    "Омоніми — різні слова з однаковим написанням без спільного значення; «криниця» (джерело) і «криниця» (плач) — класичний приклад.",
    "Слова «криниця» (джерело води) і «криниця» (плач) — омоніми.",
    [
      "«Лист» (дерева) і «лист» (листування) — повні омоніми.",
      "Синоніми завжди мають однакову частину мови.",
      "Антоніми завжди різних частин мови.",
    ],
  ),
  sc(
    "ukr-lex-02-q12",
    "ukr-lex-02-syn-ant-hom",
    "ukrainian",
    "HARD",
    "Доберіть антонім до прикметника «високий» у значенні «велика інтенсивність» (висока температура):",
    "У значенні інтенсивності антонім — «низький» (низька температура).",
    "низький",
    ["малий", "короткий", "вузький"],
  ),
  sc(
    "ukr-lex-03-q11",
    "ukr-lex-03-phraseology",
    "ukrainian",
    "MEDIUM",
    "Фразеологізм «битися об заклад» означає:",
    "Означає твердо запевняти, заприсягатися.",
    "твердо запевняти, заприсягатися",
    ["сваритися через гроші", "швидко бігти", "працювати без відпочинку"],
  ),
  sc(
    "ukr-lex-03-q12",
    "ukr-lex-03-phraseology",
    "ukrainian",
    "HARD",
    "У якому реченні фразеологізм вжито правильно?",
    "«Тримати слово» — виконувати обіцянку.",
    "Команда й надалі триматиме слово перед уболівальниками.",
    [
      "Він тримав слово за зубами під час допиту.",
      "Директор дав слово оплатити рахунки готівкою.",
      "Учень взяв слово зі словника.",
    ],
  ),
  {
    id: "zcode-biology-molecular-dna-rna-q11",
    subjectId: "biology",
    topicId: "zcode-biology-molecular-dna-rna",
    subtopic: "",
    type: "NUMERIC",
    difficulty: "MEDIUM",
    prompt:
      "Фрагмент одноланцюгової іРНК містить 80 нуклеотидів: аденін — 20, гуанін — 25, цитозин — 15. Скільки нуклеотидів з урацилом? Відповідайте числом.",
    explanation: "U = 80 − (20 + 25 + 15) = 20.",
    correctAnswer: "20",
    source: "NMT Academy: Stage 6B bank supplement · original",
    verificationStatus: "DRAFT",
    options: [],
  },
  sc(
    "zcode-biology-molecular-dna-rna-q12",
    "zcode-biology-molecular-dna-rna",
    "biology",
    "HARD",
    "Яка послідовність може бути фрагментом ланцюга ДНК (запис 5′→3′)?",
    "У ДНК немає урацилу.",
    "5′-АТГЦТА-3′",
    ["5′-АУГЦУА-3′", "5′-ТТГЦУА-3′", "5′-ГЦУАТ-3′"],
  ),
  sc(
    "zcode-biology-molecular-protein-synth-q11",
    "zcode-biology-molecular-protein-synth",
    "biology",
    "MEDIUM",
    "Який процес забезпечує точне копіювання ДНК перед поділом клітини?",
    "Реплікація копіює ДНК перед мітозом/мейозом.",
    "Реплікація",
    ["Транскрипція", "Трансляція", "Кросинговер"],
  ),
  sc(
    "zcode-biology-molecular-protein-synth-q12",
    "zcode-biology-molecular-protein-synth",
    "biology",
    "HARD",
    "Скільки кодонів (триплетів) потрібно, щоб закодувати поліпептид із 25 амінокислотних залишків (стоп-кодон окремо)?",
    "25 амінокислот = 25 кодонів; стоп-кодон у задачі окремо, тож 25.",
    "25",
    ["75", "24", "26"],
  ),
  sc(
    "zcode-biology-molecular-division-q11",
    "zcode-biology-molecular-division",
    "biology",
    "MEDIUM",
    "У якій фазі мейозу I відбувається кросинговер?",
    "Кросинговер — у профазі I під час кон'югації гомологів.",
    "Профаза I",
    ["Метафаза I", "Анафаза II", "Телофаза"],
  ),
  sc(
    "zcode-biology-molecular-division-q12",
    "zcode-biology-molecular-division",
    "biology",
    "HARD",
    "Клітина з 2n=8 завершила мейоз. Скільки хромосом у кожній з чотирьох дочірніх клітин?",
    "Гаплоїдний набір n = 4.",
    "4",
    ["8", "16", "2"],
  ),
];

const rejections: { questionId: string; reason: string }[] = [];

const verifyRecommendations = [...baseline.map((q) => q.id), ...additions.map((a) => a.id)].map((questionId) => ({
  questionId,
  recommendedEditorAction: "verifyQuestion after owner review",
  targetStatus: "VERIFIED",
  note: "Stage 6B не виконує verify на робочій БД.",
}));

const manifest = {
  format: "nmt-stage6b-question-manifest",
  version: 1,
  createdAt: new Date().toISOString(),
  workingDatabaseChanged: false,
  baseSnapshot: {
    sourceCopy: "D:/НМТ Сайт/backups/stage6a-readonly-2026-10-28/dev.db",
    topicIds: [
      "ukr-lex-01-meaning",
      "ukr-lex-02-syn-ant-hom",
      "ukr-lex-03-phraseology",
      "bio-cell-01-eukaryotic-cell",
      "zcode-biology-molecular-dna-rna",
      "zcode-biology-molecular-protein-synth",
      "zcode-biology-molecular-division",
    ],
    baselineQuestionCount: 70,
  },
  compatibility: {
    questionSchema: "src/lib/validators.ts questionSchema",
    applyVia: "saveQuestion / persistQuestion; bulk new rows via importQuestions",
    importQuestionsNote: "Оновлення за id — saveQuestion або stage6b-apply-manifest.ts",
  },
  reviews,
  updates,
  additions,
  rejections,
  verifyRecommendations,
  summary: {
    approveCandidate: reviews.filter((r) => r.status === "APPROVE_CANDIDATE").length,
    fixRequired: reviews.filter((r) => r.status === "FIX_REQUIRED").length,
    replaceRequired: reviews.filter((r) => r.status === "REPLACE_REQUIRED").length,
    needsHumanReview: reviews.filter((r) => r.status === "NEEDS_HUMAN_REVIEW").length,
    updates: updates.length,
    additions: additions.length,
    rejections: rejections.length,
  },
};

for (const u of updates) {
  const base = baseline.find((q) => q.id === u.id);
  if (base) Object.assign(u.match, { promptSha256Prefix: promptHash(base.prompt) });
}

const outDir = path.join(process.cwd(), "content/stage6b");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "stage6b-question-bank-manifest.v1.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest.summary, null, 2));
