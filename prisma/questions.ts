import { PRACTICE_SOURCE } from "../src/lib/constants";

export type SeedOption = { id: string; label: string; text: string; matchKey?: string | null; sortOrder: number };
export type SeedQuestion = {
  id: string;
  subjectId: string;
  topicId: string;
  subtopic: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation: string;
  correctAnswer: string;
  options: SeedOption[];
};

const source = PRACTICE_SOURCE;

function choice(id: string, correctLabel: string, options: [string, string][]): SeedOption[] {
  return options.map(([label, text], index) => ({
    id: `${id}-${label}`,
    label,
    text,
    sortOrder: index,
  })).map((option) => option);
}

export const questions: SeedQuestion[] = [
  q("q-m1", "math", "math-linear-eq", "EASY", "SINGLE_CHOICE", "Розв'яжіть рівняння $2x + 3 = 11$.", "2x = 8, тому x = 4.", "q-m1-А", [
    ["А", "$x=4$"], ["Б", "$x=5$"], ["В", "$x=7$"], ["Г", "$x=8$"],
  ]),
  q("q-m2", "math", "math-linear-eq", "EASY", "SINGLE_CHOICE", "Розв'яжіть рівняння $5x = 20$.", "Поділіть обидві частини на 5: x = 4.", "q-m2-А", [
    ["А", "$x=4$"], ["Б", "$x=2$"], ["В", "$x=5$"], ["Г", "$x=15$"],
  ]),
  q("q-m3", "math", "math-linear-eq", "EASY", "NUMERIC", "Знайдіть корінь рівняння $x + 7 = 15$. У відповіді запишіть лише число.", "x = 8.", "8", []),
  q("q-m4", "math", "math-linear-eq", "EASY", "SINGLE_CHOICE", "Розв'яжіть рівняння $3(x - 1) = 9$.", "x − 1 = 3, тому x = 4.", "q-m4-В", [
    ["А", "$x=2$"], ["Б", "$x=3$"], ["В", "$x=4$"], ["Г", "$x=6$"],
  ]),
  q("q-m5", "math", "math-linear-eq", "MEDIUM", "SINGLE_CHOICE", "Розв'яжіть рівняння $2(x + 3) = 4x - 2$.", "2x + 6 = 4x − 2, звідки 8 = 2x і x = 4.", "q-m5-Б", [
    ["А", "$x=2$"], ["Б", "$x=4$"], ["В", "$x=5$"], ["Г", "$x=8$"],
  ]),
  q("q-m6", "math", "math-linear-eq", "MEDIUM", "NUMERIC", "Знайдіть корінь рівняння $\\dfrac{x}{2} + 3 = 7$.", "x/2 = 4, тому x = 8.", "8", []),
  {
    id: "q-m7",
    subjectId: "math",
    topicId: "math-linear-eq",
    subtopic: "Алгоритм",
    type: "SEQUENCE",
    difficulty: "MEDIUM",
    prompt: "Установіть правильну послідовність кроків розв'язання рівняння $3x - 5 = 10$.",
    explanation: "Спочатку додаємо 5, потім ділимо на 3 і перевіряємо корінь підстановкою.",
    correctAnswer: JSON.stringify(["q-m7-1", "q-m7-2", "q-m7-3"]),
    options: [
      { id: "q-m7-1", label: "1", text: "Додати 5 до обох частин", sortOrder: 0 },
      { id: "q-m7-2", label: "2", text: "Поділити обидві частини на 3", sortOrder: 1 },
      { id: "q-m7-3", label: "3", text: "Перевірити корінь підстановкою", sortOrder: 2 },
    ],
  },
  {
    id: "q-m8",
    subjectId: "math",
    topicId: "math-linear-eq",
    subtopic: "Відповідність",
    type: "MATCHING",
    difficulty: "MEDIUM",
    prompt: "Установіть відповідність між рівнянням і його коренем.",
    explanation: "2x = 10 дає 5; x − 3 = 4 дає 7; x/5 = 2 дає 10.",
    correctAnswer: JSON.stringify({ "q-m8-l1": "q-m8-r1", "q-m8-l2": "q-m8-r2", "q-m8-l3": "q-m8-r3" }),
    options: [
      { id: "q-m8-l1", label: "1", text: "$2x=10$", matchKey: "left", sortOrder: 0 },
      { id: "q-m8-l2", label: "2", text: "$x-3=4$", matchKey: "left", sortOrder: 1 },
      { id: "q-m8-l3", label: "3", text: "$\\dfrac{x}{5}=2$", matchKey: "left", sortOrder: 2 },
      { id: "q-m8-r1", label: "А", text: "$5$", matchKey: "right", sortOrder: 3 },
      { id: "q-m8-r2", label: "Б", text: "$7$", matchKey: "right", sortOrder: 4 },
      { id: "q-m8-r3", label: "В", text: "$10$", matchKey: "right", sortOrder: 5 },
    ],
  },
  q("q-m9", "math", "math-linear-eq", "MEDIUM", "SINGLE_CHOICE", "Розв'яжіть рівняння $4x - 8 = 0$.", "4x = 8, тому x = 2.", "q-m9-Б", [
    ["А", "$x=0$"], ["Б", "$x=2$"], ["В", "$x=4$"], ["Г", "$x=8$"],
  ]),
  q("q-m10", "math", "math-linear-eq", "HARD", "NUMERIC", "Знайдіть корінь рівняння $0{,}5x + 1{,}5 = 4$.", "0,5x = 2,5, тому x = 5.", "5", []),
  q("q-m11", "math", "math-linear-eq", "HARD", "STEP_BY_STEP", "Розв'яжіть рівняння $3(2x - 1) - 2(x + 4) = 5$. Запишіть хід розв'язання і кінцеве значення $x$.", "6x − 3 − 2x − 8 = 5, 4x − 11 = 5, 4x = 16, x = 4.", "4", []),
  q("q-m12", "math", "math-linear-eq", "HARD", "SINGLE_CHOICE", "Систему $\\begin{cases}x+y=5\\\\ x-y=1\\end{cases}$ розв'язано відносно $x$. Яке значення $x$?", "Додаємо рівняння: 2x = 6, x = 3. Тоді y = 2.", "q-m12-В", [
    ["А", "$1$"], ["Б", "$2$"], ["В", "$3$"], ["Г", "$4$"],
  ]),
  q("q-u1", "ukrainian", "ukr-ortho", "EASY", "SINGLE_CHOICE", "Оберіть правильне написання.", "Не з дієсловом зазвичай пишеться окремо.", "q-u1-А", [
    ["А", "не знаю"], ["Б", "незнаю"], ["В", "ні знаю"], ["Г", "не-знаю"],
  ]),
  q("q-u2", "ukrainian", "ukr-ortho", "EASY", "SINGLE_CHOICE", "Оберіть правильне написання назви рослини.", "Після м перед я пишеться апостроф: м'ята.", "q-u2-А", [
    ["А", "м'ята"], ["Б", "мята"], ["В", "мйата"], ["Г", "мьята"],
  ]),
  q("q-u3", "ukrainian", "ukr-ortho", "EASY", "SINGLE_CHOICE", "Оберіть правильне дієслово зі значенням наближення.", "Префікс при- тут означає наближення.", "q-u3-А", [
    ["А", "приїхати"], ["Б", "преїхати"], ["В", "приїхать"], ["Г", "пріїхати"],
  ]),
  q("q-u4", "ukrainian", "ukr-ortho", "EASY", "SINGLE_CHOICE", "Оберіть правильне написання.", "Перед к пишеться префікс с-: сказати.", "q-u4-А", [
    ["А", "сказати"], ["Б", "зказати"], ["В", "ськазати"], ["Г", "ізказати"],
  ]),
  {
    id: "q-u5",
    subjectId: "ukrainian",
    topicId: "ukr-ortho",
    subtopic: "Апостроф",
    type: "SHORT_TEXT",
    difficulty: "MEDIUM",
    prompt: "Запишіть правильно слово: м…ята (рослина).",
    explanation: "Правильно: м'ята.",
    correctAnswer: "м'ята|м’ята|мʼята",
    options: [],
  },
  q("q-u6", "ukrainian", "ukr-ortho", "MEDIUM", "SINGLE_CHOICE", "Оберіть правильне написання.", "Невідмінюваний числівник пів зі значенням половини з іменником у родовому відмінку однини пишемо окремо: пів яблука (Український правопис, 2019, § 36).", "q-u6-Г", [
    ["А", "пів'яблука"], ["Б", "півяблука"], ["В", "пів-яблука"], ["Г", "пів яблука"],
  ]),
  q("q-u7", "ukrainian", "ukr-ortho", "MEDIUM", "SINGLE_CHOICE", "Оберіть правильне написання.", "Перед дзвінким приголосним пишеться з-: зробити.", "q-u7-А", [
    ["А", "зробити"], ["Б", "сробити"], ["В", "з-робити"], ["Г", "зьробити"],
  ]),
  {
    id: "q-u8",
    subjectId: "ukrainian",
    topicId: "ukr-ortho",
    subtopic: "Префікси",
    type: "MATCHING",
    difficulty: "MEDIUM",
    prompt: "Установіть відповідність між словом і правилом написання префікса.",
    explanation: "Прекрасний — пре- вищого ступеня; приїхати — при- наближення; сказати — с- перед к.",
    correctAnswer: JSON.stringify({ "q-u8-l1": "q-u8-r1", "q-u8-l2": "q-u8-r2", "q-u8-l3": "q-u8-r3" }),
    options: [
      { id: "q-u8-l1", label: "1", text: "прекрасний", matchKey: "left", sortOrder: 0 },
      { id: "q-u8-l2", label: "2", text: "приїхати", matchKey: "left", sortOrder: 1 },
      { id: "q-u8-l3", label: "3", text: "сказати", matchKey: "left", sortOrder: 2 },
      { id: "q-u8-r1", label: "А", text: "пре- на позначення високого ступеня", matchKey: "right", sortOrder: 3 },
      { id: "q-u8-r2", label: "Б", text: "при- на позначення наближення", matchKey: "right", sortOrder: 4 },
      { id: "q-u8-r3", label: "В", text: "с- перед к", matchKey: "right", sortOrder: 5 },
    ],
  },
  q("q-u9", "ukrainian", "ukr-ortho", "MEDIUM", "SINGLE_CHOICE", "Оберіть правильне написання займенника.", "Займенник будь-хто пишеться через дефіс.", "q-u9-А", [
    ["А", "будь-хто"], ["Б", "будь хто"], ["В", "будьхто"], ["Г", "будь- хто"],
  ]),
  q("q-u10", "ukrainian", "ukr-ortho", "HARD", "SINGLE_CHOICE", "Оберіть правильне написання іменника.", "Іменник незалежність пишеться разом.", "q-u10-А", [
    ["А", "незалежність"], ["Б", "не залежність"], ["В", "не-залежність"], ["Г", "нізалежність"],
  ]),
  q("q-u11", "ukrainian", "ukr-ortho", "HARD", "SINGLE_CHOICE", "Оберіть правильне написання.", "У слові розв'язати після губного в перед я є апостроф.", "q-u11-Б", [
    ["А", "розвязати"], ["Б", "розв'язати"], ["В", "розвьязати"], ["Г", "розв-язати"],
  ]),
  q("q-u12", "ukrainian", "ukr-ortho", "HARD", "SINGLE_CHOICE", "Оберіть нормативне написання запозиченого слова.", "Після губного п перед ю пишеться апостроф: комп'ютер.", "q-u12-А", [
    ["А", "комп'ютер"], ["Б", "компютер"], ["В", "компьютр"], ["Г", "комп’ютерний пристрій без апострофа: компютер"],
  ]),
  q("q-h1", "history", "hist-kyiv", "EASY", "SINGLE_CHOICE", "У якому році, за літописною традицією, відбулося хрещення Русі?", "Хрещення Русі датовано 988 роком.", "q-h1-В", [
    ["А", "882"], ["Б", "907"], ["В", "988"], ["Г", "1097"],
  ]),
  q("q-h2", "history", "hist-kyiv", "EASY", "SINGLE_CHOICE", "Хто очолив хрещення Русі?", "Князь Володимир Великий.", "q-h2-А", [
    ["А", "Володимир Великий"], ["Б", "Ярослав Мудрий"], ["В", "Святослав Ігорович"], ["Г", "Данило Галицький"],
  ]),
  q("q-h3", "history", "hist-kyiv", "EASY", "SINGLE_CHOICE", "З яким князем пов'язують укладання «Руської правди»?", "Збірник «Руська правда» пов'язують із Ярославом Мудрим.", "q-h3-Б", [
    ["А", "Олег"], ["Б", "Ярослав Мудрий"], ["В", "Ігор"], ["Г", "Ольга"],
  ]),
  q("q-h4", "history", "hist-kyiv", "EASY", "NUMERIC", "Запишіть рік хрещення Русі числом.", "988.", "988", []),
  q("q-h5", "history", "hist-kyiv", "MEDIUM", "SINGLE_CHOICE", "Яку подію літописна традиція відносить до 882 року?", "Олег утвердився в Києві, об'єднавши київські та новгородські землі за літописною оповіддю.", "q-h5-А", [
    ["А", "Утвердження Олега в Києві"], ["Б", "Любецький з'їзд"], ["В", "Хрещення Русі"], ["Г", "Будівництво Софії Київської"],
  ]),
  q("q-h6", "history", "hist-kyiv", "MEDIUM", "SINGLE_CHOICE", "Кому приписують фразу «Іду на ви»?", "Князю Святославу Ігоровичу.", "q-h6-В", [
    ["А", "Ярославу Мудрому"], ["Б", "Володимиру Мономаху"], ["В", "Святославу Ігоровичу"], ["Г", "Ользі"],
  ]),
  q("q-h7", "history", "hist-kyiv", "MEDIUM", "SINGLE_CHOICE", "Хто з княгинь провела податкову реформу після повстання древлян?", "Княгиня Ольга.", "q-h7-А", [
    ["А", "Ольга"], ["Б", "Анна"], ["В", "Рогніда"], ["Г", "Либідь"],
  ]),
  {
    id: "q-h8",
    subjectId: "history",
    topicId: "hist-kyiv",
    subtopic: "Персоналії",
    type: "MATCHING",
    difficulty: "MEDIUM",
    prompt: "Установіть відповідність між діячем і тим, із чим його пов'язують.",
    explanation: "Володимир — хрещення; Ярослав — «Руська правда»; Мономах — «Повчання дітям».",
    correctAnswer: JSON.stringify({ "q-h8-l1": "q-h8-r1", "q-h8-l2": "q-h8-r2", "q-h8-l3": "q-h8-r3" }),
    options: [
      { id: "q-h8-l1", label: "1", text: "Володимир Великий", matchKey: "left", sortOrder: 0 },
      { id: "q-h8-l2", label: "2", text: "Ярослав Мудрий", matchKey: "left", sortOrder: 1 },
      { id: "q-h8-l3", label: "3", text: "Володимир Мономах", matchKey: "left", sortOrder: 2 },
      { id: "q-h8-r1", label: "А", text: "Хрещення Русі", matchKey: "right", sortOrder: 3 },
      { id: "q-h8-r2", label: "Б", text: "«Руська правда»", matchKey: "right", sortOrder: 4 },
      { id: "q-h8-r3", label: "В", text: "«Повчання дітям»", matchKey: "right", sortOrder: 5 },
    ],
  },
  {
    id: "q-h9",
    subjectId: "history",
    topicId: "hist-kyiv",
    subtopic: "Хронологія",
    type: "SEQUENCE",
    difficulty: "HARD",
    prompt: "Розташуйте події в хронологічній послідовності.",
    explanation: "882 — Олег у Києві; 988 — хрещення; 1097 — Любецький з'їзд.",
    correctAnswer: JSON.stringify(["q-h9-1", "q-h9-2", "q-h9-3"]),
    options: [
      { id: "q-h9-1", label: "1", text: "Утвердження Олега в Києві (882)", sortOrder: 0 },
      { id: "q-h9-2", label: "2", text: "Хрещення Русі (988)", sortOrder: 1 },
      { id: "q-h9-3", label: "3", text: "Любецький з'їзд (1097)", sortOrder: 2 },
    ],
  },
  q("q-h10", "history", "hist-kyiv", "HARD", "SINGLE_CHOICE", "Яке рішення закріпив Любецький з'їзд 1097 року?", "Князі домовилися, що кожен тримає свою отчину.", "q-h10-Б", [
    ["А", "Негайне хрещення всієї Русі"], ["Б", "Кожен князь тримає свою отчину"], ["В", "Перенесення столиці до Галича"], ["Г", "Скасування полюддя Ольгою"],
  ]),
  q("q-h11", "history", "hist-kyiv", "MEDIUM", "SHORT_TEXT", "Як звали сестру Кия, Щека та Хорива за літописною легендою про заснування Києва?", "Либідь.", "Либідь|либідь", []),
  q("q-h12", "history", "hist-kyiv", "HARD", "SINGLE_CHOICE", "Яку пам'ятку в Києві пов'язують із правлінням Ярослава Мудрого?", "Софійський собор.", "q-h12-А", [
    ["А", "Софійський собор"], ["Б", "Костел Єзуїтів"], ["В", "Будинок із химерами"], ["Г", "Маріїнський палац"],
  ]),
  q("q-b1", "biology", "bio-cell", "EASY", "SINGLE_CHOICE", "Яка органела забезпечує синтез АТФ?", "Мітохондрія.", "q-b1-А", [
    ["А", "Мітохондрія"], ["Б", "Рибосома"], ["В", "Лізосома"], ["Г", "Комплекс Гольджі"],
  ]),
  q("q-b2", "biology", "bio-cell", "EASY", "SINGLE_CHOICE", "Де відбувається синтез білка?", "На рибосомах.", "q-b2-Б", [
    ["А", "У вакуолі"], ["Б", "На рибосомах"], ["В", "У клітинній стінці"], ["Г", "У ядерці лише як кінцевий продукт"],
  ]),
  q("q-b3", "biology", "bio-cell", "EASY", "SINGLE_CHOICE", "Яка органела рослинної клітини здійснює фотосинтез?", "Хлоропласт.", "q-b3-А", [
    ["А", "Хлоропласт"], ["Б", "Мітохондрія"], ["В", "Центріоль"], ["Г", "Рибосома"],
  ]),
  q("q-b4", "biology", "bio-cell", "EASY", "SINGLE_CHOICE", "Де в еукаріотичній клітині переважно зберігається спадкова інформація?", "В ядрі. Частина ДНК також є в мітохондріях і хлоропластах.", "q-b4-В", [
    ["А", "Лише в клітинній стінці"], ["Б", "Лише в рибосомі"], ["В", "У ядрі"], ["Г", "Лише в вакуолі"],
  ]),
  q("q-b5", "biology", "bio-cell", "MEDIUM", "NUMERIC", "Скільки дочірніх клітин зазвичай утворюється внаслідок одного мітозу?", "Дві.", "2", []),
  q("q-b6", "biology", "bio-cell", "MEDIUM", "SINGLE_CHOICE", "Який процес утворює гамети зі зменшеним удвічі набором хромосом?", "Мейоз.", "q-b6-Б", [
    ["А", "Мітоз"], ["Б", "Мейоз"], ["В", "Транскрипція"], ["Г", "Трансляція"],
  ]),
  {
    id: "q-b7",
    subjectId: "biology",
    topicId: "bio-cell",
    subtopic: "Органели",
    type: "MATCHING",
    difficulty: "MEDIUM",
    prompt: "Установіть відповідність між структурою клітини та її функцією.",
    explanation: "Мембрана транспортує речовини вибірково, хлоропласт здійснює фотосинтез, рибосома синтезує білок.",
    correctAnswer: JSON.stringify({ "q-b7-l1": "q-b7-r1", "q-b7-l2": "q-b7-r2", "q-b7-l3": "q-b7-r3" }),
    options: [
      { id: "q-b7-l1", label: "1", text: "Плазматична мембрана", matchKey: "left", sortOrder: 0 },
      { id: "q-b7-l2", label: "2", text: "Хлоропласт", matchKey: "left", sortOrder: 1 },
      { id: "q-b7-l3", label: "3", text: "Рибосома", matchKey: "left", sortOrder: 2 },
      { id: "q-b7-r1", label: "А", text: "Вибірковий транспорт речовин", matchKey: "right", sortOrder: 3 },
      { id: "q-b7-r2", label: "Б", text: "Фотосинтез", matchKey: "right", sortOrder: 4 },
      { id: "q-b7-r3", label: "В", text: "Синтез білка", matchKey: "right", sortOrder: 5 },
    ],
  },
  q("q-b8", "biology", "bio-cell", "MEDIUM", "SINGLE_CHOICE", "Що є характерною ознакою рослинної клітини порівняно з тваринною?", "Клітинна стінка з целюлози, хлоропласти та велика вакуоля.", "q-b8-А", [
    ["А", "Клітинна стінка, хлоропласти, велика вакуоля"], ["Б", "Відсутність ядра"], ["В", "Відсутність мембрани"], ["Г", "Наявність лише мітохондрій без інших органел"],
  ]),
  q("q-b9", "biology", "bio-cell", "MEDIUM", "SINGLE_CHOICE", "Основу плазматичної мембрани складають", "Фосфоліпіди та білки.", "q-b9-Б", [
    ["А", "лише ДНК"], ["Б", "фосфоліпіди та білки"], ["В", "лише крохмаль"], ["Г", "хітин"],
  ]),
  {
    id: "q-b10",
    subjectId: "biology",
    topicId: "bio-cell",
    subtopic: "Рівні організації",
    type: "SEQUENCE",
    difficulty: "HARD",
    prompt: "Розташуйте рівні від меншого до більшого.",
    explanation: "Молекула входить до складу органели, органели — до клітини.",
    correctAnswer: JSON.stringify(["q-b10-1", "q-b10-2", "q-b10-3"]),
    options: [
      { id: "q-b10-1", label: "1", text: "Молекула", sortOrder: 0 },
      { id: "q-b10-2", label: "2", text: "Органела", sortOrder: 1 },
      { id: "q-b10-3", label: "3", text: "Клітина", sortOrder: 2 },
    ],
  },
  q("q-b11", "biology", "bio-cell", "HARD", "SHORT_TEXT", "Як називається органела дихання клітини, у якій синтезується АТФ?", "Мітохондрія.", "мітохондрія|митохондрія", []),
  q("q-b12", "biology", "bio-cell", "HARD", "SINGLE_CHOICE", "Чим прокаріотична клітина відрізняється від еукаріотичної?", "У прокаріотів немає оформленого ядра.", "q-b12-А", [
    ["А", "Немає оформленого ядра"], ["Б", "Немає ДНК"], ["В", "Завжди має хлоропласти"], ["Г", "Не має плазматичної мембрани"],
  ]),
].map((item) => item);

function q(
  id: string,
  subjectId: string,
  topicId: string,
  difficulty: string,
  type: string,
  prompt: string,
  explanation: string,
  correctAnswer: string,
  options: [string, string][],
): SeedQuestion {
  return {
    id,
    subjectId,
    topicId,
    subtopic: "",
    type,
    difficulty,
    prompt,
    explanation,
    correctAnswer,
    options: options.map(([label, text], index) => ({ id: `${id}-${label}`, label, text, sortOrder: index })),
  };
}

export const questionSource = source;

void choice;
void source;
