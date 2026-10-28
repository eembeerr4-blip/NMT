import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "content", "stage6c");
mkdirSync(outDir, { recursive: true });

const checkedAt = "2026-10-28T20:47:00.000Z";

/** @param {string} id */
function watch(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * @param {object} p
 * @returns {object}
 */
function candidate(p) {
  return {
    youtubeId: p.id,
    url: watch(p.id),
    title: p.title,
    channel: p.channel,
    durationSec: p.durationSec ?? null,
    languageExpected: "uk",
    languageEvidence: p.languageEvidence,
    availability: p.availability ?? "AVAILABLE",
    embeddable: p.embeddable ?? true,
    verificationLevel: p.verificationLevel,
    verificationNotes: p.verificationNotes,
    contentChecks: p.contentChecks ?? [],
    gapsForNmt: p.gapsForNmt ?? [],
    sources: p.sources ?? [],
    checkedAt: p.checkedAt ?? checkedAt,
  };
}

const lessons = [
  {
    topicId: "ukr-lex-01-meaning",
    title: "Лексичне значення слова",
    currentPrimary: candidate({
      id: "NDmd6xU9F2E",
      title: "Українська мова. Лексикологія. Лексичне значення слова. Однозначні й багатозначні слова",
      channel: "Всеукраїнська школа онлайн",
      durationSec: 663,
      languageEvidence: "Офіційний канал ВШО; у player API є доріжки «Українська» та автоматичні uk-субтитри. Озвучку власнику слід підтвердити на прослуховування.",
      embeddable: true,
      verificationLevel: "METADATA_ONLY",
      verificationNotes:
        "Доступність, тривалість (11:03) і embed підтверджено через YouTube watch page + playabilityStatus OK (2026-10-28). Зміст уроку за назвою/програмою ВШО, але повного перегляду або VTT-транскрипту не отримано.",
      gapsForNmt: [
        "Пряме й переносне значення",
        "Тавтологія, плеоназм, лексичні помилки",
        "Пароніми та калькування",
      ],
      sources: [
        { title: "YouTube oEmbed/watch API", url: watch("NDmd6xU9F2E") },
        { title: "ВШО LMS — курс 5–6 класів, урок 7", url: "https://lms.e-school.net.ua/courses/course-v1%3AUIED%2BUM-NUSH-5-6th%2B2022/about" },
      ],
    }),
    recommendation: {
      action: "KEEP_WITH_OWNER_PREVIEW",
      summary:
        "Залишити поточне відео ВШО як основне: найкраще збігається з темою та офіційною програмою. Перед CONFIRMED власник має прослухати урок і перевірити блоки про пряме/переносне значення та типові НМТ-помилки.",
      primary: null,
      supplement: null,
    },
    alternatives: [
      candidate({
        id: "JpswIiSw4kM",
        title: "Досліджуємо пряме й переносне значення слів. Урок 14. Українська мова. 2 клас",
        channel: "LearningUa",
        durationSec: 336,
        languageEvidence: "Назва українською; канал навчальний. Озвучку не слухали.",
        verificationLevel: "NOT_VERIFIED",
        verificationNotes: "Може закрити прогалину про пряме/переносне, але рівень 2 класу — нижчий за НМТ; лише як додатковий матеріал.",
      }),
    ],
    ownerStillToCheck: [
      "Чи достатньо в NDmd6xU9F2E прямого/переносного значення для банку питань ukr-lex-01.",
      "Якість озвучки та темп для старшокласників.",
    ],
  },
  {
    topicId: "ukr-lex-02-syn-ant-hom",
    title: "Синоніми, антоніми, омоніми",
    currentPrimary: candidate({
      id: "scigg_eN4qs",
      title: "10 клас. Українська мова. Лексичні та фразеологічні синоніми, антоніми. Синонімічне багатство мови",
      channel: "Всеукраїнська школа онлайн",
      durationSec: 549,
      languageEvidence: "Канал ВШО; субтитри uk у player API.",
      embeddable: true,
      verificationLevel: "METADATA_ONLY",
      verificationNotes:
        "Embed OK, 9:09. Синоніми/антоніми за назвою відповідають уроку, але омонімія в цьому ролику не заявлена — потребує другого відео.",
      gapsForNmt: ["Омоніми vs полісемія", "Омоформи, омофони, омографи", "Домінанта синонімічного ряду"],
    }),
    recommendation: {
      action: "KEEP_PLUS_SUPPLEMENT",
      summary:
        "Основне відео scigg_eN4qs залишити для синонімів і антонімів. Обов’язково додати друге відео про омоніми — рекомендовано o9xcL5pCxog (ВШО), зміст якого частково підтверджено за публічним текстом уроку.",
      primary: candidate({
        id: "scigg_eN4qs",
        title: "10 клас. Українська мова. Лексичні та фразеологічні синоніми, антоніми. Синонімічне багатство мови",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 549,
        languageEvidence: "ВШО, uk-субтитри.",
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "Див. currentPrimary.",
        role: "primary",
      }),
      supplement: candidate({
        id: "o9xcL5pCxog",
        title: "Українська мова. Омоніми. Пароніми. Словник омонімів. Словник паронімів",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 681,
        languageEvidence: "ВШО, uk-субтитри.",
        embeddable: true,
        verificationLevel: "VERIFIED_CONTENT",
        verificationNotes:
          "У публічному тексті/описі уроку (перевірка 2026-10-28) є визначення омонімів, розмежування з багатозначністю, омофони, омографи, омоформи та міжмовні омоніми — відповідає цілям ukr-lex-02.",
        contentChecks: [
          "Омоніми vs багатозначність",
          "Омофони, омографи, омоформи",
          "Пароніми та словники",
        ],
        sources: [{ title: "YouTube — текст уроку o9xcL5pCxog", url: watch("o9xcL5pCxog") }],
        role: "supplement",
      }),
    },
    alternatives: [
      candidate({
        id: "bwNYjWXn2Qc",
        title: "Типи омонімів. НУШ, 5 клас, українська мова",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 215,
        languageEvidence: "ВШО; uk auto-captions.",
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "Короткий урок; зміст не верифіковано повним переглядом.",
      }),
      candidate({
        id: "Vp2ze1l-UOs",
        title: "Усе про ОМОНІМИ [Підготовка до ЗНО]",
        channel: "дисКурс",
        durationSec: 520,
        languageEvidence: "Українська назва та опис; субтитрів у API немає.",
        verificationLevel: "NOT_VERIFIED",
        verificationNotes: "Опис глав відповідає НМТ, але відео не переглянуто; канал не ВШО.",
      }),
    ],
    ownerStillToCheck: [
      "Чи прийнятна двовідео схема (син/ант + омоніми) замість одного ролика.",
      "Повний перегляд o9xcL5pCxog на предмет глибини для HARD-питань банку.",
    ],
  },
  {
    topicId: "ukr-lex-03-phraseology",
    title: "Фразеологізми",
    currentPrimary: candidate({
      id: "oZfA9V0mhV4",
      title: "Українська мова. Джерела українських фразеологізмів. Фразеологізми у мовленні людини",
      channel: "Всеукраїнська школа онлайн",
      durationSec: 686,
      languageEvidence: "ВШО; uk-субтитри.",
      embeddable: true,
      verificationLevel: "METADATA_ONLY",
      verificationNotes: "Embed OK, 11:26. Акцент на джерелах; тестові типи НМТ (кальки, синтаксична роль) не підтверджені.",
      gapsForNmt: [
        "Лексичне значення фразеологізмів у тестах",
        "Фразеологічні синоніми/антоніми",
        "Типові помилки й кальки",
      ],
    }),
    recommendation: {
      action: "TWO_PART_SET",
      summary:
        "Рекомендовано пара: wm0X68H_WtQ (лексичне значення фразеологізмів, частково підтверджено текстом уроку) + oZfA9V0mhV4 (джерела). Одного oZfA9V0mhV4 замало для повного покриття банку.",
      primary: candidate({
        id: "wm0X68H_WtQ",
        title: "Українська мова. Фразеологія. Поняття про фразеологізм, його лексичне значення",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 625,
        languageEvidence: "ВШО; uk-субтитри.",
        verificationLevel: "VERIFIED_CONTENT",
        verificationNotes:
          "У публічному тексті уроку пояснюються поняття фразеологізму, цілісне значення, фразеологічний словник — ключове для НМТ.",
        contentChecks: ["Визначення фразеологізму", "Лексичне значення", "Фразеологічний словник"],
        role: "primary",
      }),
      supplement: candidate({
        id: "oZfA9V0mhV4",
        title: "Українська мова. Джерела українських фразеологізмів. Фразеологізми у мовленні людини",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 686,
        verificationLevel: "METADATA_ONLY",
        role: "supplement",
      }),
    },
    alternatives: [
      candidate({
        id: "RKf9IWykd-8",
        title: "Українська мова. Різновиди фразеологізмів. Прислів’я, приказки, крилаті вирази, афоризми",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 670,
        verificationLevel: "METADATA_ONLY",
      }),
    ],
    ownerStillToCheck: [
      "Чи достатньо пари wm0X68H_WtQ + oZfA9V0mhV4 для ukr-lex-03-q11/q12.",
      "Перегляд на відсутність застарілих/неточних трактувань.",
    ],
  },
  {
    topicId: "bio-cell-01-eukaryotic-cell",
    title: "Будова еукаріотичної клітини",
    currentPrimary: candidate({
      id: "7DtFjdHJvKg",
      title: "Будова еукаріотичної клітини",
      channel: "Уроки біології, Тютюнникова Наталія",
      durationSec: 326,
      languageEvidence: "Опис українською; лише автоматичні uk-субтитри.",
      embeddable: true,
      verificationLevel: "METADATA_ONLY",
      verificationNotes: "5:26, embed OK. Зміст не верифіковано; короткий огляд 7 класу.",
      gapsForNmt: [
        "Класифікація органел за мембранами",
        "Порівняння рослинної, тваринної, грибної клітини",
        "Типові задачі «органела → функція»",
      ],
    }),
    recommendation: {
      action: "REPLACE_PRIMARY",
      summary:
        "Замінити основне відео на bBymW0PtVT0 (українська анімація Nucleus Medical Media): зміст підтверджено розгорнутим публічним транскриптом (прок/еук, органели, росл/твар). Додати коротке jCVunU5VGbI про різноманітність клітин царств.",
      primary: candidate({
        id: "bBymW0PtVT0",
        title: "Будова клітини [Nucleus Medical Media]",
        channel: "Nucleus Medical Media (укр. озвучення)",
        durationSec: 450,
        languageEvidence: "Український транскрипт/озвучення в ролику; auto uk captions.",
        verificationLevel: "VERIFIED_CONTENT",
        verificationNotes:
          "Транскрипт підтверджує прокаріоти/еукаріоти, ядро, ЕПР, апарат Гольджі, мітохондрії, лізосоми, хлоропласти, клітинна стінка.",
        contentChecks: ["Про- vs еукаріоти", "Основні органели", "Рослинна vs тваринна клітина"],
        role: "primary",
      }),
      supplement: candidate({
        id: "jCVunU5VGbI",
        title: "Різноманітність еукаріотичних клітин",
        channel: "BioLogos",
        durationSec: 105,
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "1:45; опис відповідає порівнянню царств — перегляд власником.",
        role: "supplement",
      }),
    },
    alternatives: [
      candidate({
        id: "t3GNTWclSf4",
        title: "Структура клітини. Ядро.",
        channel: "Tetiana Chychkovska",
        durationSec: 701,
        verificationLevel: "METADATA_ONLY",
      }),
      candidate({
        id: "7DtFjdHJvKg",
        title: "Будова еукаріотичної клітини",
        channel: "Уроки біології, Тютюнникова Наталія",
        durationSec: 326,
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "Поточний кандидат; залишити як запасний.",
      }),
    ],
    ownerStillToCheck: [
      "Прийнятність медичної анімації (не ВШО) як основного відео.",
      "Наукова точність формулювань у bBymW0PtVT0.",
    ],
  },
  {
    topicId: "zcode-biology-molecular-dna-rna",
    title: "ДНК і РНК",
    currentPrimary: candidate({
      id: "R4USDzLsfNk",
      title: "ДНК. РНК.(нуклеїнові кислоти)",
      channel: "БІОЛОГІЯ до НМТ",
      durationSec: 161,
      languageEvidence: "Назва українською; субтитрів немає.",
      embeddable: true,
      verificationLevel: "METADATA_ONLY",
      verificationNotes: "Лише 2:41; дуже стисло; зміст не верифіковано.",
      gapsForNmt: ["Будова нуклеотиду", "Правило Чаргаффа", "Комplementarity 5′/3′", "Типи РНК"],
    }),
    recommendation: {
      action: "REPLACE_PRIMARY",
      summary:
        "Замінити на урок ВШО G63P4uoP6Fs (≈15 хв, uk-субтитри) про нуклеїнові кислоти; за потреби додати K541lnwQmTQ для транскрипції/типів РНК.",
      primary: candidate({
        id: "G63P4uoP6Fs",
        title: "9 клас. Біологія. Нуклеїнові кислоти. Роль нуклеїнових кислот як носія спадкової інформації. АТФ. Ч1",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 909,
        languageEvidence: "ВШО; uk-субтитри.",
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "Відповідає темі 5 ВШО 9 класу; предметний перегляд власником обов’язковий.",
        role: "primary",
      }),
      supplement: candidate({
        id: "K541lnwQmTQ",
        title: "9 клас. Біологія. Подвоєння ДНК; репарація. Типи РНК. Транскрипція.",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 960,
        verificationLevel: "METADATA_ONLY",
        role: "supplement",
      }),
    },
    alternatives: [
      candidate({
        id: "R4USDzLsfNk",
        title: "ДНК. РНК.(нуклеїнові кислоти)",
        channel: "БІОЛОГІЯ до НМТ",
        durationSec: 161,
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "Поточний — замінити через малу тривалість.",
      }),
      candidate({
        id: "nDY-dpkunOQ",
        title: "Біологія 9 клас Нуклеїнові кислоти",
        channel: "Уроки біології, Тютюнникова Наталія",
        durationSec: null,
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "oEmbed підтверджено; тривалість не знята в цій сесії.",
      }),
    ],
    ownerStillToCheck: [
      "Чи є в G63P4uoP6Fs правило Чаргаффа та задачі на відсотковий склад.",
      "Чи потрібна частина 2 серії ВШО (якщо існує) для РНК.",
    ],
  },
  {
    topicId: "zcode-biology-molecular-protein-synth",
    title: "Реплікація ДНК і біосинтез білка",
    currentPrimary: candidate({
      id: "ia61JnRXC9o",
      title: "Реплікація ДНК та РНК транскрипція і трансляція | Академія Хана",
      channel: "KhanAcademyUkrainian",
      durationSec: 793,
      languageEvidence: "Офіційний канал Khan UA; auto uk captions.",
      embeddable: true,
      verificationLevel: "METADATA_ONLY",
      verificationNotes: "13:13, embed OK. Тема широка; точність формулювань і задач банку — на перегляд власника.",
      gapsForNmt: ["Стоп-кодон у розрахунках", "Антикодони тРНК", "5′/3′ орієнтація"],
    }),
    recommendation: {
      action: "REPLACE_OR_DUAL",
      summary:
        "Для вирівнювання з програмою ВШО 9 класу рекомендовано vs6GLwIxI-U (генетичний код і біосинтез — частково підтверджено текстом уроку) + UGE4mfJliqo (реплікація). Поточне ia61JnRXC9o залишити сильною альтернативою одним роликом.",
      primary: candidate({
        id: "vs6GLwIxI-U",
        title: "9 клас. Біологія. Генетичний код. Біосинтез білка",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 979,
        verificationLevel: "VERIFIED_CONTENT",
        verificationNotes:
          "Публічний текст уроку містить триплетність, таблицю кодонів, трансляцію — ключ для банку protein-synth.",
        contentChecks: ["Генетичний код", "Триплети", "Біосинтез білка / трансляція"],
        role: "primary",
      }),
      supplement: candidate({
        id: "UGE4mfJliqo",
        title: "Біологія 9 клас  Подвоєння ДНК  Репарація пошкоджень ДНК",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 350,
        verificationLevel: "METADATA_ONLY",
        role: "supplement",
      }),
    },
    alternatives: [
      candidate({
        id: "ia61JnRXC9o",
        title: "Реплікація ДНК та РНК транскрипція і трансляція | Академія Хана",
        channel: "KhanAcademyUkrainian",
        durationSec: 793,
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "Поточний кандидат — можна лишити як один комплексний ролик.",
      }),
      candidate({
        id: "K541lnwQmTQ",
        title: "9 клас. Біологія. Подвоєння ДНК; репарація. Типи РНК. Транскрипція.",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 960,
        verificationLevel: "METADATA_ONLY",
      }),
    ],
    ownerStillToCheck: [
      "Чи покриває vs6GLwIxI-U реплікацію без UGE4mfJliqo.",
      "Порівняти точність Khan vs ВШО для q08 банку.",
    ],
  },
  {
    topicId: "zcode-biology-molecular-division",
    title: "Клітинний цикл. Мітоз і мейоз",
    currentPrimary: candidate({
      id: "WMtpCLP1B2A",
      title: "Мітоз і мейоз/ Фази мітозу і мейозу / будова хромосом.",
      channel: "MikoBiolog / Биология онлайн",
      durationSec: 602,
      languageEvidence: "Назва змішана uk/ru; auto uk captions — не доказ живої української подачі.",
      embeddable: true,
      verificationLevel: "NOT_VERIFIED",
      verificationNotes:
        "10:02, embed OK, але канал містить «Биология онлайн»; предметна й мовна якість не підтверджені переглядом.",
      gapsForNmt: ["Інтерфаза", "Підрахунок хромосом/хроматид", "Мейоз I vs II"],
    }),
    recommendation: {
      action: "REPLACE_PRIMARY",
      summary:
        "Замінити на 19a17ENs64g (ВШО 9 клас: клітинний цикл, мітоз, мейоз) — офіційна програма, 13:35, embed OK. Зміст METADATA_ONLY до перегляду власника.",
      primary: candidate({
        id: "19a17ENs64g",
        title: "9 клас. Біологія. Поділ клітин: клітинний цикл, мітоз. Мейоз",
        channel: "Всеукраїнська школа онлайн",
        durationSec: 815,
        languageEvidence: "ВШО; uk-субтитри.",
        verificationLevel: "METADATA_ONLY",
        role: "primary",
      }),
      supplement: candidate({
        id: "RV-aJuuOHrE",
        title: "Мітоз | Академія Хана",
        channel: "KhanAcademyUkrainian",
        durationSec: 240,
        verificationLevel: "METADATA_ONLY",
        verificationNotes: "Лише мітоз; як додаткове повторення, не заміна мейозу.",
        role: "supplement",
      }),
    },
    alternatives: [
      candidate({
        id: "Gq1W3lVGkYk",
        title: "Клітинний цикл і мітоз – Підготовка до ЗНО – Біологія",
        channel: "EdEra",
        durationSec: 422,
        verificationLevel: "METADATA_ONLY",
      }),
      candidate({
        id: "WMtpCLP1B2A",
        title: "Мітоз і мейоз/ Фази мітозу і мейозу / будова хромосом.",
        channel: "MikoBiolog / Биология онлайн",
        durationSec: 602,
        verificationLevel: "NOT_VERIFIED",
        verificationNotes: "Поточний — не рекомендовано без перегляду.",
      }),
    ],
    ownerStillToCheck: [
      "Повний перегляд 19a17ENs64g на задачі з хромосомами/хроматидами.",
      "Чи потрібен окремий акцент на мейоз II.",
    ],
  },
];

const manifest = {
  format: "nmt-stage6c-video-candidates",
  version: 1,
  id: "stage6c-video-candidates-v1",
  createdAt: checkedAt,
  language: "uk",
  workingDatabaseChanged: false,
  automaticConfirmed: false,
  notAppliedToDatabase: true,
  applyNote:
    "Дослідницький пакет Stage 6C. Не імпортувати в prisma/dev.db і не виставляти CONFIRMED без окремого рішення власника.",
  researchLimitations: [
    "Повний перегляд у браузері не виконувався; частина висновків — METADATA_ONLY (oEmbed + YouTube player JSON).",
    "Завантаження VTT через timedtext API повернуло порожні відповіді; VERIFIED_CONTENT базується лише там, де є незалежний публічний текст уроку з пошуку/опису.",
    "Озвучка uk не слухалась у цій сесії; субтитри не замінюють перевірку мови власником.",
    "Автоматичні тести не доводять педагогічну придатність для НМТ.",
  ],
  topicCount: lessons.length,
  lessons,
};

writeFileSync(path.join(outDir, "stage6c-video-candidates.v1.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

function fmtDuration(sec) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function badge(level) {
  const map = {
    VERIFIED_CONTENT: "verified",
    METADATA_ONLY: "meta",
    NOT_VERIFIED: "unknown",
  };
  return map[level] ?? "unknown";
}

const htmlParts = [];
htmlParts.push(`<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stage 6C — огляд відео (7 уроків)</title>
  <style>
    :root { font-family: system-ui, Segoe UI, sans-serif; line-height: 1.45; color: #111; }
    body { max-width: 920px; margin: 0 auto; padding: 1.25rem; }
    .banner { background: #fff8e6; border: 1px solid #e6c200; padding: .75rem 1rem; border-radius: 8px; margin-bottom: 1.25rem; }
    nav a { margin-right: .75rem; }
    article { border: 1px solid #ddd; border-radius: 10px; padding: 1rem; margin: 1rem 0; }
    .chip { display: inline-block; font-size: .75rem; padding: .15rem .45rem; border-radius: 999px; margin-right: .35rem; }
    .chip.verified { background: #d1fae5; }
    .chip.meta { background: #e0e7ff; }
    .chip.unknown { background: #fee2e2; }
    ul.compact li { margin: .25rem 0; }
    a { color: #0b57d0; }
  </style>
</head>
<body>
  <div class="banner">
    <strong>Stage 6C — локальний огляд.</strong> Рішення не в БД. CONFIRMED не виставлялось. Пакет: <code>stage6c-video-candidates.v1.json</code>.
  </div>
  <nav>`);
for (const lesson of lessons) {
  htmlParts.push(`<a href="#${lesson.topicId}">${lesson.title}</a>`);
}
htmlParts.push(`</nav>`);

for (const lesson of lessons) {
  const rec = lesson.recommendation;
  const cur = lesson.currentPrimary;
  htmlParts.push(`
  <article id="${lesson.topicId}">
    <h2>${lesson.title}</h2>
    <p><code>${lesson.topicId}</code></p>
    <h3>Поточне відео в дослідженні</h3>
    <p><span class="chip ${badge(cur.verificationLevel)}">${cur.verificationLevel}</span>
    <a href="${cur.url}" target="_blank" rel="noreferrer">${cur.title}</a> · ${cur.channel} · ${fmtDuration(cur.durationSec)}</p>
    <p>${cur.verificationNotes}</p>
    <h3>Рекомендація</h3>
    <p><strong>${rec.action}</strong> — ${rec.summary}</p>`);
  if (rec.primary) {
    htmlParts.push(`<p><strong>Основне:</strong> <span class="chip ${badge(rec.primary.verificationLevel)}">${rec.primary.verificationLevel}</span>
    <a href="${rec.primary.url}" target="_blank" rel="noreferrer">${rec.primary.title}</a> · ${fmtDuration(rec.primary.durationSec)}</p>`);
  }
  if (rec.supplement) {
    htmlParts.push(`<p><strong>Додатково:</strong> <span class="chip ${badge(rec.supplement.verificationLevel)}">${rec.supplement.verificationLevel}</span>
    <a href="${rec.supplement.url}" target="_blank" rel="noreferrer">${rec.supplement.title}</a> · ${fmtDuration(rec.supplement.durationSec)}</p>`);
  }
  if (lesson.alternatives?.length) {
    htmlParts.push(`<h3>Альтернативи (до 3)</h3><ul class="compact">`);
    for (const alt of lesson.alternatives.slice(0, 3)) {
      htmlParts.push(`<li><span class="chip ${badge(alt.verificationLevel)}">${alt.verificationLevel}</span>
        <a href="${alt.url}" target="_blank" rel="noreferrer">${alt.title}</a> · ${alt.channel ?? "—"}</li>`);
    }
    htmlParts.push(`</ul>`);
  }
  htmlParts.push(`<h3>Власнику перевірити</h3><ul class="compact">`);
  for (const item of lesson.ownerStillToCheck) htmlParts.push(`<li>${item}</li>`);
  htmlParts.push(`</ul></article>`);
}

htmlParts.push(`</body></html>`);
writeFileSync(path.join(outDir, "stage6c-owner-review.html"), htmlParts.join("\n"), "utf8");

console.log("Wrote manifest and HTML for", lessons.length, "lessons");
