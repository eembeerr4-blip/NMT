import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "content", "stage6b");
const manifest = JSON.parse(readFileSync(path.join(root, "stage6b-question-bank-manifest.v1.json"), "utf8"));
const baseline = JSON.parse(readFileSync(path.join(root, "exported-questions-baseline.json"), "utf8"));

const topics = [
  ["ukr-lex-01-meaning", "Лексичне значення слова"],
  ["ukr-lex-02-syn-ant-hom", "Синоніми, антоніми, омоніми"],
  ["ukr-lex-03-phraseology", "Фразеологізми"],
  ["bio-cell-01-eukaryotic-cell", "Будова еукаріотичної клітини"],
  ["zcode-biology-molecular-dna-rna", "ДНК і РНК"],
  ["zcode-biology-molecular-protein-synth", "Реплікація ДНК і біосинтез білка"],
  ["zcode-biology-molecular-division", "Клітинний цикл. Мітоз і мейоз"],
];
const topicTitle = Object.fromEntries(topics);
const topicIds = new Set(topics.map(([id]) => id));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function contentHash(question) {
  return sha256(JSON.stringify({
    prompt: question.prompt,
    explanation: question.explanation,
    correctAnswer: question.correctAnswer,
    options: question.options.map((option) => ({
      label: option.label,
      text: option.text,
      matchKey: option.matchKey ?? null,
    })),
  }));
}

function humanAnswer(question) {
  const byId = Object.fromEntries(question.options.map((option) => [option.id, option]));
  if (question.type === "SINGLE_CHOICE") {
    const option = byId[question.correctAnswer];
    if (!option) throw new Error(`Нерозв'язаний ключ ${question.id}`);
    return `${option.label}) ${option.text}`;
  }
  if (question.type === "NUMERIC" || question.type === "SHORT_TEXT") return String(question.correctAnswer);
  if (question.type === "MATCHING") {
    const pairs = JSON.parse(question.correctAnswer);
    return Object.entries(pairs)
      .sort((a, b) => byId[a[0]].label.localeCompare(byId[b[0]].label, "uk"))
      .map(([leftId, rightId]) => `${byId[leftId].label}) ${byId[leftId].text} → ${byId[rightId].label}) ${byId[rightId].text}`)
      .join("\n");
  }
  if (question.type === "SEQUENCE") {
    return JSON.parse(question.correctAnswer)
      .map((id, index) => `${index + 1}. ${byId[id].label}) ${byId[id].text}`)
      .join("\n");
  }
  throw new Error(question.type);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const baselineById = new Map(baseline.map((question) => [question.id, question]));
if (baselineById.size !== 70) throw new Error("baseline");
const update = manifest.updates[0];
const v1 = [];
for (const source of baselineById.values()) {
  const question = source.id === update.id ? clone(update.question) : clone(source);
  question.verificationStatus = "DRAFT";
  question.origin = source.id === update.id ? "v1-corrected" : "original";
  v1.push(question);
}
for (const addition of manifest.additions) v1.push({ ...clone(addition), origin: "new", verificationStatus: "DRAFT" });
if (v1.length !== 84) throw new Error("v1 count");

const v1Snapshot = clone(v1);
const byId = new Map(v1.map((question) => [question.id, question]));

function must(id) {
  const question = byId.get(id);
  if (!question) throw new Error(id);
  return question;
}

const sources = {
  q10: [
    { title: "СУМ-11: ТАКТ¹ і ТАКТ²", url: "https://slovnyk.me/dict/sum/%D1%82%D0%B0%D0%BA%D1%82", supports: "Дві окремі статті: музична одиниця / ритм / такт механізму і почуття міри. У ТАКТ¹ є множина «такти»." },
    { title: "ВТССУМ: ТАКТ1 і ТАКТ2", url: "https://vtssum.wdbk.org/%D1%82/%D1%82%D0%B0%D0%BA%D1%82", supports: "Те саме розведення на два слова, не на значення однієї статті." },
    { title: "DWDS, Etymologisches Wörterbuch: Takt", url: "https://www.dwds.de/wb/etymwb/Takt", supports: "Обидва значення сходять до лат. tactus: музичне напряму, тактовність через франц. tact." },
  ],
  q11hom: [
    { title: "СУМ-11: КЛЮЧ¹ і КЛЮЧ²", url: "https://slovnyk.me/dict/sum/%D0%BA%D0%BB%D1%8E%D1%87", supports: "КЛЮЧ¹ — знаряддя для замка; КЛЮЧ², рідко — джерело. Це різні статті." },
    { title: "СУМ-11 і СУМ-20: криниця", url: "https://slovnyk.me/dict/sum/%D0%BA%D1%80%D0%B8%D0%BD%D0%B8%D1%86%D1%8F", supports: "Одна стаття: колодязь; рідко джерело; переносно джерело. Значення «плач» немає." },
  ],
  q11mean: [
    { title: "СУМ-11: медальйон", url: "https://slovnyk.me/dict/sum/%D0%BC%D0%B5%D0%B4%D0%B0%D0%BB%D1%8C%D0%B9%D0%BE%D0%BD", supports: "Нормативна форма — медальйон. Окремої статті «медальон» немає." },
    { title: "СУМ-20: медальйон", url: "https://slovnyk.me/dict/newsum/%D0%BC%D0%B5%D0%B4%D0%B0%D0%BB%D1%8C%D0%B9%D0%BE%D0%BD", supports: "Та сама форма і значення ювелірного виробу." },
  ],
  q12mean: [
    { title: "Фразеологічний словник української мови, передмова", url: "https://archive.org/stream/slov556/slov556_djvu.txt", supports: "Стійке словосполучення словник наводить як «брати участь», не як «прийняти участь»." },
  ],
  q11phr: [
    { title: "СУМ-11: заклад", url: "https://sum.in.ua/s/zaklad", supports: "Битися об заклад — сперечатися на гроші, річ тощо." },
    { title: "Фразеологія «битися об заклад»", url: "https://goroh.pp.ua/%D0%A4%D1%80%D0%B0%D0%B7%D0%B5%D0%BE%D0%BB%D0%BE%D0%B3%D1%96%D1%8F/%D0%B1%D0%B8%D1%82%D0%B8%D1%81%D1%8F%20%D0%BE%D0%B1%20%D0%B7%D0%B0%D0%BA%D0%BB%D0%B0%D0%B4", supports: "Два підтверджені відтінки: парі і запевнення. Офіційної присяги й роботи без відпочинку немає." },
  ],
  q12phr: [
    { title: "Фразеологічний словник: слово", url: "https://slovnyk.me/dict/phraseology/%D1%81%D0%BB%D0%BE%D0%B2%D0%BE", supports: "Держати (тримати) слово — виконувати обіцяне. Окремий відтінок «виголошувати промову» стосується форми «держати слово», не майбутнього «триматиме слово»." },
  ],
};

const q08Biology = {
  questionId: "zcode-biology-molecular-protein-synth-q08",
  textChangedInV2: false,
  verdict: "Розрахунок 40 узгоджений з умовою і з триплетним кодом. Заміна русизмів сама по собі коректності не доводить; її підтверджує умова.",
  confirmed: [
    "120 нуклеотидів діляться на 3 без остачі: 40 кодонів.",
    "Умова прямо виводить стоп-кодон і неперекладні ділянки за межі цих 120, тож ділити треба лише кодони амінокислот.",
    "Стоп-кодон амінокислотного залишку не додає. Якщо старт-кодон входить у ці 120, він кодує метіонін і вже входить у 40.",
    "Післятрансляційне відрізання в умові не задане, тому віднімати нічого.",
  ],
  notClaimed: "Заміна «Кодируюча / нетрансльовані» на «Кодуюча / неперекладні» лише знімає кальку. Число 40 тримається на умові задачі, не на самій заміні слів.",
};

function remember(question) {
  return {
    prompt: question.prompt,
    explanation: question.explanation,
    correctAnswer: question.correctAnswer,
    answerText: humanAnswer(question),
    promptSha256: sha256(question.prompt),
  };
}

const corrections = [];

function applyCorrection(id, edit, meta) {
  const question = must(id);
  const before = remember(question);
  if (before.prompt !== meta.expectedPrompt) throw new Error(`Неочікувана стара умова ${id}`);
  edit(question);
  question.verificationStatus = "DRAFT";
  question.origin = "v2-corrected";
  question.source = "NMT Academy: Stage 6B.2 correction · draft";
  if (question.topicId !== meta.topicId || question.difficulty !== meta.difficulty || question.type !== "SINGLE_CHOICE") {
    throw new Error(`Межі питання змінено ${id}`);
  }
  corrections.push({
    id,
    action: "UPDATE_SAME_ID",
    replaceRequired: false,
    reason: meta.reason,
    sources: meta.sources,
    match: {
      prompt: before.prompt,
      promptSha256: before.promptSha256,
      correctAnswer: before.correctAnswer,
      answerText: before.answerText,
    },
    question: {
      id: question.id,
      subjectId: question.subjectId,
      topicId: question.topicId,
      subtopic: question.subtopic ?? "",
      type: question.type,
      difficulty: question.difficulty,
      prompt: question.prompt,
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      source: question.source,
      verificationStatus: "DRAFT",
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        text: option.text,
        matchKey: option.matchKey ?? null,
      })),
    },
  });
}

applyCorrection("ukr-lex-02-q10", (question) => {
  question.prompt = "З'ясуйте, у якому рядку наведені слова є саме омонімами, а НЕ значеннями одного багатозначного слова:";
  question.explanation = "СУМ-11 і ВТССУМ подають два різні слова: ТАКТ¹ (метрична музична одиниця, ритм, такт механізму; є множина «такти») і ТАКТ² (почуття міри в поведінці). У сучасній українській між цими значеннями немає живого смислового зв’язку, тому рядок Б — лексичні омоніми, а не багатозначність. Спільне віддалене джерело — латинське tactus «дотик»: музичне значення запозичене через німецьке Takt, а «почуття міри» — через французьке tact (DWDS). Походження не є абсолютно різним, і називати цю пару повними омонімами підстав немає: парадигма ТАКТ² у словникових прикладах обмежена одниною. Рядки А, В і Г — переносні значення слів «глибокий», «крило» і «зерно».";
}, {
  expectedPrompt: "З'ясуйте, у якому рядку виділені слова є саме омонімами, а НЕ значеннями одного багатозначного слова:",
  topicId: "ukr-lex-02-syn-ant-hom",
  difficulty: "HARD",
  reason: "Ключ Б підтверджено окремими статтями ТАКТ¹ і ТАКТ². Прибрано непідтверджені формулювання про абсолютно різну етимологію і повні омоніми. Слово «виділені» замінено на «наведені», бо в варіантах нічого не виділено.",
  sources: sources.q10,
});

applyCorrection("ukr-lex-02-q11", (question) => {
  question.prompt = "Яке твердження відповідає словниковій нормі?";
  question.options.find((option) => option.label === "А").text = "«Глибокий яр» і «глибока думка» — лексичні омоніми.";
  question.options.find((option) => option.label === "Б").text = "Лексичні синоніми можуть належати до різних частин мови.";
  question.options.find((option) => option.label === "В").text = "Антоніми завжди належать до різних частин мови.";
  question.options.find((option) => option.label === "Г").text = "«Ключ» (знаряддя для замка) і «ключ» (джерело) — лексичні омоніми.";
  question.correctAnswer = "ukr-lex-02-q11-opt-Г";
  question.explanation = "СУМ-11 має окремі статті КЛЮЧ¹ «знаряддя для замка» і КЛЮЧ² «джерело», тож це омоніми. «Глибокий яр» і «глибока думка» — пряме й переносне значення одного прикметника, не омоніми. Лексичні синоніми й антоніми належать до однієї частини мови, тому Б і В хибні. Старе твердження про «криницю» в значенні «плач» прибрано: СУМ-11 і СУМ-20 такого значення не мають.";
}, {
  expectedPrompt: "Яке твердження правильне?",
  topicId: "ukr-lex-02-syn-ant-hom",
  difficulty: "MEDIUM",
  reason: "Непідтверджене значення «криниця» = «плач» вилучено. Нове питання того самого рівня має один ключ, підтверджений статтями КЛЮЧ¹ і КЛЮЧ². ID збережено для адресного оновлення.",
  sources: sources.q11hom,
});

applyCorrection("ukr-lex-01-q11", (question) => {
  const option = question.options.find((item) => item.label === "Г");
  if (!option.text.includes("медальон")) throw new Error("немає медальон");
  option.text = "Вона отримала золотий медальйон на ювілей.";
  question.explanation = "«Золотий медальйон» називає прикрасу, тож прикметник ужито в прямому значенні. «Золоті руки», «золоте серце» і «золотий характер» — переносні значення. Нормативна форма за СУМ-11 і СУМ-20 — «медальйон».";
}, {
  expectedPrompt: "У якому реченні слово «золотий» вжите в прямому значенні?",
  topicId: "ukr-lex-01-meaning",
  difficulty: "MEDIUM",
  reason: "У правильному варіанті виправлено написання «медальон» на «медальйон». Пряме значення лишається в рядку Г; три інші варіанти й далі переносні.",
  sources: sources.q11mean,
});

applyCorrection("ukr-lex-01-q12", (question) => {
  question.prompt = "У якому варіанті допущено лексичну помилку?";
  question.options.find((option) => option.label === "А").text = "Сплатити рахунок за проїзд у транспорті.";
  question.options.find((option) => option.label === "Б").text = "Взяти участь у конференції.";
  question.options.find((option) => option.label === "В").text = "Відкрити підручник на потрібній сторінці.";
  question.options.find((option) => option.label === "Г").text = "Прийняти участь у конференції.";
  question.correctAnswer = "ukr-lex-01-q12-opt-Г";
  question.explanation = "Нормативне стійке словосполучення — «брати / взяти участь». «Прийняти участь» є калькою і не збігається з цим сполученням. «Сплатити рахунок», «взяти участь» і «відкрити підручник» лексичної помилки не містять, тож правильний рядок лише Г.";
}, {
  expectedPrompt: "У якому варіанті немає лексичної помилки?",
  topicId: "ukr-lex-01-meaning",
  difficulty: "HARD",
  reason: "Старе питання мало два нормативні рядки: «відкрити підручник» і «сплатити рахунок». Тепер питається, де помилка є, і помилка одна: «прийняти участь».",
  sources: sources.q12mean,
});

applyCorrection("ukr-lex-03-q11", (question) => {
  question.prompt = "Яке формулювання найповніше передає словникове значення фразеологізма «битися об заклад»?";
  question.options.find((option) => option.label === "А").text = "Сваритися з кимось через уже програні гроші.";
  question.options.find((option) => option.label === "Б").text = "Складати урочисту присягу перед початком служби.";
  question.options.find((option) => option.label === "В").text = "Працювати без перерви, доки не буде результату.";
  question.options.find((option) => option.label === "Г").text = "Сперечатися, домовляючись про виграш, або запевняти в чомусь.";
  question.correctAnswer = "ukr-lex-03-q11-opt-Г";
  question.explanation = "СУМ-11 у статті «заклад» тлумачить «битися об заклад» як сперечатися на гроші чи річ. Фразеологічні джерела додають другий відтінок: запевняти в чомусь. Разом це передає лише рядок Г. А описує сварку після програшу, Б — офіційну присягу, а не емфатичне «я б’юся об заклад, що…», В — іншу ситуацію, якої в статті немає.";
}, {
  expectedPrompt: "Фразеологізм «битися об заклад» означає:",
  topicId: "ukr-lex-03-phraseology",
  difficulty: "MEDIUM",
  reason: "Старе пояснення зводило фразеологізм до «заприсягатися» і пропускало парі. Новий ключ збирає обидва підтверджені відтінки, а відволікаючі варіанти називають інші ситуації.",
  sources: sources.q11phr,
});

applyCorrection("ukr-lex-03-q12", (question) => {
  question.prompt = "У якому реченні фразеологізм «тримати слово» вжито в значенні «виконувати обіцяне»?";
  question.options.find((option) => option.label === "А").text = "Він тримав слово за зубами під час допиту.";
  question.options.find((option) => option.label === "Б").text = "Директор тримав слово в шухляді разом із печаткою.";
  question.options.find((option) => option.label === "В").text = "Учень тримав слово на кінчику язика і врешті промовчав.";
  question.options.find((option) => option.label === "Г").text = "Капітан пообіцяв підтримку і триматиме слово.";
  question.correctAnswer = "ukr-lex-03-q12-opt-Г";
  question.explanation = "Фразеологічний словник фіксує «держати (тримати) слово» як виконувати обіцяне. Це значення є лише в рядку Г. А змішує вислів із «тримати язик за зубами», Б розуміє дієслово буквально, В змішує його з «на кінчику язика». Форму «дати слово» з тексту прибрано, бо вона має окремі значення «пообіцяти» і «надати слово для виступу».";
}, {
  expectedPrompt: "У якому реченні фразеологізм вжито правильно?",
  topicId: "ukr-lex-03-phraseology",
  difficulty: "HARD",
  reason: "Старе речення «дав слово оплатити» було другим нормативним уживанням фразеологізма «дати слово». Тепер умова називає лише «тримати слово» в значенні обіцянки, і таке вживання одне.",
  sources: sources.q12phr,
});

if (corrections.length !== 6) throw new Error("corrections");

const unchanged = [];
for (const question of v1Snapshot) {
  const next = must(question.id);
  const same = question.prompt === next.prompt && question.explanation === next.explanation && question.correctAnswer === next.correctAnswer
    && JSON.stringify(question.options) === JSON.stringify(next.options);
  if (corrections.some((item) => item.id === question.id)) {
    if (same) throw new Error(`Не змінено ${question.id}`);
  } else if (!same) {
    throw new Error(`Зайва зміна ${question.id}`);
  } else unchanged.push(question.id);
}
if (unchanged.length !== 78) throw new Error("unchanged");

const q08 = must("zcode-biology-molecular-protein-synth-q08");
if (!q08.prompt.startsWith("Кодуюча ділянка") || q08.correctAnswer !== "40") throw new Error("q08");

const order = Object.fromEntries(topics.map(([id], index) => [id, index]));
const questions = [...byId.values()].sort((a, b) => order[a.topicId] - order[b.topicId] || a.id.localeCompare(b.id, "uk"));
for (const question of questions) {
  question.verificationStatus = "DRAFT";
  question.topicTitle = topicTitle[question.topicId];
  question.answerText = humanAnswer(question);
  question.contentHash = contentHash(question);
  question.changedInV2 = corrections.some((item) => item.id === question.id);
  const correction = corrections.find((item) => item.id === question.id);
  question.changeReason = correction?.reason ?? "";
  question.sources = correction?.sources ?? [];
  question.previous = correction ? { prompt: correction.match.prompt, answerText: correction.match.answerText } : null;
  if (!topicIds.has(question.topicId)) throw new Error(question.topicId);
}
if (new Set(questions.map((question) => question.id)).size !== 84) throw new Error("unique");

const counts = {};
for (const [topicId] of topics) {
  const rows = questions.filter((question) => question.topicId === topicId);
  const difficulty = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const row of rows) difficulty[row.difficulty] += 1;
  if (rows.length !== 12 || difficulty.EASY < 4 || difficulty.MEDIUM < 5 || difficulty.HARD < 3) throw new Error(topicId);
  counts[topicId] = difficulty;
}

const packet = {
  format: "nmt-stage6b-question-manifest",
  version: 2,
  basedOn: {
    file: "content/stage6b/stage6b-question-bank-manifest.v1.json",
    version: 1,
    createdAt: manifest.createdAt,
  },
  createdAt: new Date().toISOString(),
  workingDatabaseChanged: false,
  automaticVerified: false,
  applyNote: "Не застосовувати на робочу SQLite і не переводити питання у VERIFIED без окремого рішення власника. stage6b-apply-manifest.ts читає лише manifest v1.",
  biologyRecheck: q08Biology,
  summary: {
    questions: 84,
    unchangedFromV1: 78,
    corrections: 6,
    replaceRequired: 0,
    verificationStatus: "DRAFT",
    counts,
  },
  corrections,
  questions: questions.map((question) => ({
    id: question.id,
    subjectId: question.subjectId,
    topicId: question.topicId,
    topicTitle: question.topicTitle,
    subtopic: question.subtopic ?? "",
    type: question.type,
    difficulty: question.difficulty,
    prompt: question.prompt,
    explanation: question.explanation,
    correctAnswer: question.correctAnswer,
    answerText: question.answerText,
    source: question.source ?? "",
    verificationStatus: "DRAFT",
    origin: question.origin,
    changedInV2: question.changedInV2,
    changeReason: question.changeReason,
    sources: question.sources,
    previous: question.previous,
    contentHash: question.contentHash,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      text: option.text,
      matchKey: option.matchKey ?? null,
      sortOrder: option.sortOrder ?? null,
    })),
  })),
};

writeFileSync(path.join(root, "stage6b-question-bank-manifest.v2.json"), `${JSON.stringify(packet, null, 2)}\n`);

const dataJson = JSON.stringify({
  packageId: "stage6b2-owner-review",
  manifestVersion: 2,
  questionCount: 84,
  changedCount: 6,
  topics: topics.map(([id, title]) => ({ id, title, difficulty: counts[id] })),
  biologyRecheck: q08Biology,
  questions: packet.questions,
}).replace(/</g, "\\u003c");

const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NMT Academy — редакторська перевірка 84 питань (Stage 6B.2)</title>
<style>
  :root { color-scheme: light; --ink:#1c1915; --muted:#5c564c; --line:#e4dccf; --paper:#f7f3ec; --card:#fffdf9; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.5 "Segoe UI", sans-serif; color: var(--ink); background: var(--paper); }
  header, main { width: min(1080px, calc(100% - 28px)); margin: 0 auto; }
  header { padding: 22px 0 12px; }
  h1 { font-size: 1.55rem; line-height: 1.25; margin: 0 0 8px; }
  h2 { font-size: 1.25rem; margin: 28px 0 10px; }
  .banner { background: #fff4d6; border: 1px solid #e2c98a; border-radius: 10px; padding: 12px 14px; margin: 12px 0; }
  .stats, .nav, .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
  .stat, .nav a, .toolbar button { border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 999px; padding: 6px 12px; text-decoration: none; font: inherit; cursor: pointer; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin: 0 0 14px; }
  .card.changed { box-shadow: inset 4px 0 0 #1d4e89; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .chip { font-size: .78rem; border-radius: 999px; padding: 2px 8px; background: #efe8dc; }
  .chip.easy { background: #e5f5ea; } .chip.medium { background: #fff1d6; } .chip.hard { background: #fde8e8; }
  .chip.id, .raw { font-family: Consolas, monospace; }
  .prompt { font-size: 1.05rem; font-weight: 650; }
  ol.options { margin: 8px 0 8px 1.2rem; } li.correct { background: #e8f6ee; border-radius: 6px; }
  .answer, .explain, .note, .old, .sources { border-radius: 10px; padding: 10px 12px; margin: 8px 0; }
  .answer { background: #e8f6ee; } .explain { background: #f3f0ea; } .note { background: #e8f1fb; } .old { background: #f6f6f6; } .sources { background: #fff; border: 1px solid var(--line); }
  .decisions { display: flex; flex-wrap: wrap; gap: 8px; }
  .decisions button, .toolbar button { font: inherit; border-radius: 8px; border: 1px solid var(--line); background: #fff; padding: 7px 12px; cursor: pointer; }
  .decisions button[aria-pressed="true"][data-verdict="approve"] { background: #1f7a4d; color: #fff; }
  .decisions button[aria-pressed="true"][data-verdict="fix"] { background: #8a5a00; color: #fff; }
  .decisions button[aria-pressed="true"][data-verdict="reject"] { background: #9b2c2c; color: #fff; }
  textarea { width: 100%; min-height: 64px; font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--line); }
  .hidden { display: none; } #import-report { color: #8a5a00; }
  @media (max-width: 640px) { header, main { width: min(100% - 16px, 1080px); } h1 { font-size: 1.3rem; } }
</style>
</head>
<body>
<header>
  <h1>Редакторська перевірка після виправлень</h1>
  <p>Stage 6B.2 · manifest v2 · 84 питання. Шість карток позначено як змінені відносно v1. Усі питання лишаються DRAFT.</p>
  <div class="banner">Рішення зберігаються лише в localStorage цього браузера під окремим ключем Stage 6B.2. Вони не потрапляють у робочу базу і не стають VERIFIED. Експорт Stage 6B.1 цей файл сам не відкриває і не застосовує. Під час імпорту JSON рішення приймається лише разом із тим самим ID і тим самим contentHash тексту. Якщо текст питання змінився, старе погодження відхиляється.</div>
  <div class="stats" id="stats"></div>
  <nav class="nav" id="nav"></nav>
  <div class="toolbar">
    <button type="button" id="filter-all">Усі</button>
    <button type="button" id="filter-changed">Змінені у v2</button>
    <button type="button" id="filter-open">Без рішення</button>
    <button type="button" id="export">Завантажити JSON</button>
    <button type="button" id="import">Імпортувати JSON</button>
    <button type="button" id="clear">Очистити рішення в браузері</button>
    <input id="import-file" class="hidden" type="file" accept="application/json,.json">
  </div>
  <p id="import-report"></p>
</header>
<main id="main"></main>
<footer id="foot"></footer>
<script id="packet" type="application/json">${dataJson}</script>
<script>
(function () {
  var packet = JSON.parse(document.getElementById("packet").textContent);
  var storageKey = "nmt-stage6b2-owner-decisions-v1";
  var filter = "all";
  var state = load();
  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      var decisions = {};
      Object.keys(parsed.decisions || {}).forEach(function (id) {
        var question = packet.questions.find(function (item) { return item.id === id; });
        if (question && parsed.decisions[id].contentHash === question.contentHash) decisions[id] = parsed.decisions[id];
      });
      return { decisions: decisions };
    } catch (error) { return { decisions: {} }; }
  }
  function save() { localStorage.setItem(storageKey, JSON.stringify(state)); renderStats(); }
  function decision(id) { return state.decisions[id] || { verdict: "", comment: "", contentHash: "" }; }
  function esc(value) { return String(value).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function typeLabel(type) { return { SINGLE_CHOICE: "Одна правильна відповідь", MATCHING: "Відповідність", SEQUENCE: "Послідовність", NUMERIC: "Число", SHORT_TEXT: "Коротка відповідь" }[type] || type; }
  function originLabel(origin) { return { original: "Вихідний", "new": "Новий", "v1-corrected": "Виправлений у v1", "v2-corrected": "Виправлений у v2" }[origin] || origin; }
  function visible(question) {
    if (filter === "changed") return question.changedInV2;
    if (filter === "open") return !decision(question.id).verdict;
    return true;
  }
  function renderStats() {
    var counts = { approve: 0, fix: 0, reject: 0, open: packet.questions.length };
    packet.questions.forEach(function (question) { var verdict = decision(question.id).verdict; if (verdict) { counts[verdict] += 1; counts.open -= 1; } });
    document.getElementById("stats").innerHTML = [["У пакеті", 84], ["Змінені у v2", packet.changedCount], ["Погодити", counts.approve], ["Виправити", counts.fix], ["Відхилити", counts.reject], ["Без рішення", counts.open]].map(function (pair) { return "<span class='stat'>" + pair[0] + ": <strong>" + pair[1] + "</strong></span>"; }).join("");
  }
  function optionsHtml(question) {
    if (!question.options.length) return "<p>Варіантів немає: відповідь уводиться числом або словом.</p>";
    return "<ol class='options'>" + question.options.map(function (option) {
      var mark = question.type === "SINGLE_CHOICE" && option.id === question.correctAnswer ? "correct" : "";
      var side = option.matchKey === "left" ? " <span class='raw'>(ліва колонка)</span>" : option.matchKey === "right" ? " <span class='raw'>(права колонка)</span>" : "";
      return "<li class='" + mark + "'><strong>" + esc(option.label) + ".</strong> " + esc(option.text) + side + "</li>";
    }).join("") + "</ol>";
  }
  function card(question) {
    var current = decision(question.id);
    var sources = question.sources.length ? "<div class='sources'><strong>Підстава.</strong><ul>" + question.sources.map(function (source) { return "<li>" + esc(source.title) + ". " + esc(source.supports) + "</li>"; }).join("") + "</ul></div>" : "";
    var previous = question.previous ? "<div class='old'><strong>Було у v1.</strong><p>" + esc(question.previous.prompt) + "</p><p>" + esc(question.previous.answerText) + "</p></div>" : "";
    var biology = question.id === packet.biologyRecheck.questionId ? "<div class='note'><strong>Повторна перевірка біології.</strong> " + esc(packet.biologyRecheck.verdict) + " " + esc(packet.biologyRecheck.notClaimed) + "</div>" : "";
    function pressed(verdict) { return current.verdict === verdict ? "true" : "false"; }
    return "<article class='card" + (question.changedInV2 ? " changed" : "") + "' id='q-" + esc(question.id) + "' data-id='" + esc(question.id) + "'><div class='meta'><span class='chip id'>" + esc(question.id) + "</span><span class='chip'>" + esc(question.topicTitle) + "</span><span class='chip " + question.difficulty.toLowerCase() + "'>" + esc(question.difficulty) + "</span><span class='chip'>" + esc(typeLabel(question.type)) + "</span><span class='chip'>" + esc(originLabel(question.origin)) + "</span><span class='chip'>DRAFT</span>" + (question.changedInV2 ? "<span class='chip'>Змінено відносно v1</span>" : "") + "</div><p class='prompt'>" + esc(question.prompt) + "</p>" + optionsHtml(question) + "<div class='answer'><strong>Правильна відповідь:</strong><br>" + esc(question.answerText).replace(/\\n/g, "<br>") + "<div class='raw'>correctAnswer: " + esc(question.correctAnswer) + "</div></div><div class='explain'><strong>Пояснення:</strong> " + esc(question.explanation) + "</div>" + (question.changeReason ? "<div class='note'><strong>Що змінено.</strong> " + esc(question.changeReason) + "</div>" : "") + sources + previous + biology + "<div class='decisions'><button type='button' data-verdict='approve' aria-pressed='" + pressed("approve") + "'>Погодити</button><button type='button' data-verdict='fix' aria-pressed='" + pressed("fix") + "'>Виправити</button><button type='button' data-verdict='reject' aria-pressed='" + pressed("reject") + "'>Відхилити</button></div><label>Коментар власника<textarea data-comment='1'>" + esc(current.comment || "") + "</textarea></label></article>";
  }
  function render() {
    document.getElementById("nav").innerHTML = packet.topics.map(function (topic) { return "<a href='#topic-" + topic.id + "'><strong>" + esc(topic.title) + "</strong> · 12</a>"; }).join("");
    document.getElementById("main").innerHTML = packet.topics.map(function (topic) {
      var rows = packet.questions.filter(function (question) { return question.topicId === topic.id && visible(question); });
      return "<section id='topic-" + topic.id + "'><h2>" + esc(topic.title) + "</h2><p>" + topic.id + " · показано " + rows.length + " з 12 · EASY " + topic.difficulty.EASY + " / MEDIUM " + topic.difficulty.MEDIUM + " / HARD " + topic.difficulty.HARD + "</p>" + (rows.map(card).join("") || "<p>У цьому фільтрі питань немає.</p>") + "</section>";
    }).join("");
    document.getElementById("foot").textContent = "Manifest v2 · 84 питання · DRAFT · рішення з цієї сторінки не застосовані до бази.";
  }
  function considerImport(parsed) {
    var accepted = {};
    var rejected = [];
    if (!parsed || parsed.packageId !== "stage6b2-owner-review" || parsed.manifestVersion !== 2 || !parsed.decisions) return { accepted: accepted, rejected: [{ id: "*", reason: "інший пакет або версія" }] };
    Object.keys(parsed.decisions).forEach(function (id) {
      var item = parsed.decisions[id];
      var question = packet.questions.find(function (entry) { return entry.id === id; });
      if (!question) { rejected.push({ id: id, reason: "немає такого ID" }); return; }
      if (!item || item.contentHash !== question.contentHash) { rejected.push({ id: id, reason: "інша версія тексту" }); return; }
      if (["approve", "fix", "reject"].indexOf(item.verdict) < 0) { rejected.push({ id: id, reason: "немає рішення" }); return; }
      accepted[id] = { verdict: item.verdict, comment: item.comment || "", contentHash: item.contentHash };
    });
    return { accepted: accepted, rejected: rejected };
  }
  document.getElementById("main").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-verdict]");
    if (!button) return;
    var card = button.closest("article");
    var id = card.getAttribute("data-id");
    var question = packet.questions.find(function (item) { return item.id === id; });
    var next = decision(id);
    next.verdict = next.verdict === button.getAttribute("data-verdict") ? "" : button.getAttribute("data-verdict");
    next.comment = card.querySelector("textarea").value;
    next.contentHash = question.contentHash;
    if (next.verdict) state.decisions[id] = next; else delete state.decisions[id];
    save();
    render();
  });
  document.getElementById("main").addEventListener("input", function (event) {
    if (!event.target.matches("textarea")) return;
    var id = event.target.closest("article").getAttribute("data-id");
    var question = packet.questions.find(function (item) { return item.id === id; });
    var next = decision(id);
    next.comment = event.target.value;
    next.contentHash = question.contentHash;
    if (next.verdict || next.comment) state.decisions[id] = next;
    save();
  });
  document.getElementById("filter-all").onclick = function () { filter = "all"; render(); };
  document.getElementById("filter-changed").onclick = function () { filter = "changed"; render(); };
  document.getElementById("filter-open").onclick = function () { filter = "open"; render(); };
  document.getElementById("export").onclick = function () {
    var payload = { packageId: packet.packageId, manifestVersion: 2, exportedAt: new Date().toISOString(), appliedToDatabase: false, verificationStatusChanged: false, note: "Рішення власника Stage 6B.2. Не імпортовані в базу і не змінюють VERIFIED.", decisions: state.decisions };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "stage6b2-owner-decisions.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  document.getElementById("import").onclick = function () { document.getElementById("import-file").click(); };
  document.getElementById("import-file").onchange = function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var result = considerImport(JSON.parse(String(reader.result)));
      state.decisions = result.accepted;
      save();
      render();
      document.getElementById("import-report").textContent = "Імпорт: прийнято " + Object.keys(result.accepted).length + ", відхилено " + result.rejected.length + ". Відхилені рішення не застосовано.";
    };
    reader.readAsText(file, "utf-8");
  };
  document.getElementById("clear").onclick = function () { if (!confirm("Прибрати рішення лише з цього браузера?")) return; state = { decisions: {} }; save(); render(); };
  renderStats();
  render();
})();
</script>
</body>
</html>
`;

writeFileSync(path.join(root, "stage6b2-owner-review.html"), html);
console.log(JSON.stringify({ questions: packet.questions.length, corrections: corrections.map((item) => item.id), q08unchanged: true }, null, 2));
