# Stage 8: review of 24 published questions

Status: READY FOR OWNER/ARCHITECT REVIEW. Working update NOT performed.

Second substantive pass, 2026-10-30. The same executor re-derived corrections from current options and external sources; this is not a second human/agent approval. The 19 key conflicts are confirmed; five original stems need replacement. Changes are proposed, not approved live data.

## Exact scope

24 Question rows: correctAnswer, explanation, selected prompt text, updatedAt only. 21 QuestionOption.text rows: 20 options in the five rewrites and one typo (цілисним → цілісним). No IDs, links, types, difficulty, source, verificationStatus or Topic fields change. All seven topics stay READY, all 24 questions stay VERIFIED. Full before/after and pinned SHA-256 are in final-24-corrections.json.

| ID | Problem | Final candidate | Sources | Result |
|---|---|---|---|---|
| s7a-math-quadratic-sub-01-e08 | За Вієтом сума коренів дорівнює −b/a=7; наявний ключ −10 хибний. | В: 7; Сума коренів x²−7x+10=0 (Віет): | INDEPENDENT_CALCULATION | PASS_SECOND_PASS |
| s7a-ukr-lexicology-section-01-e03 | Омоніми мають однакову форму й різне значення; це не синоніми. | Б: слова однакової форми з різним значенням; Яке визначення найточніше характеризує лексичні омоніми? | UKBOOK | PASS_SECOND_PASS |
| s7a-ukr-lexicology-section-01-e04 | Фразеологізм — стійке сполучення з цілісним значенням, не діалектизм. | Б: стійке словосполучення з цілісним значенням; Фразеологізм — це: | UKBOOK | PASS_SECOND_PASS |
| s7a-ukr-lexicology-section-01-m02 | Пароніми подібні за звучанням, але відрізняються значенням. | А: слова схожі за звучанням/написанням, але різні за значенням; Пароніми — це: | UKBOOK | PASS_SECOND_PASS |
| s7a-ukr-lexicology-section-01-m03 | Пряме значення є буквальним; наявний ключ «тільки переносне» протилежний визначенню. | Б: буквальне, предметне значення; Пряме значення слова — це: | UKBOOK | PASS_SECOND_PASS |
| s7a-ukr-lexicology-section-01-m04 | Багатозначне слово має кілька пов’язаних значень. Приклад «кінь дощів» у поясненні треба прибрати. | Б: має кілька пов’язаних значень; Багатозначне слово: | UKBOOK | PASS_SECOND_PASS |
| s7a-ukr-ortho-sub-01-e08 | У слові колосся після л пишемо о. Пояснення не повинно підміняти написання посиланням на інше слово. | А: о; Яку букву слід написати замість пропуску в слові «кол_сся»? | UKBOOK, LEXICON:колосся | PASS_SECOND_PASS |
| s7a-ukr-ortho-sub-01-e11 | У слові пишу голосна и; у писати → пишу відбувається чергування с/ш, а не зміна и на е. | А: и; Яку букву слід написати замість пропуску у формі «п_шу» (від «писати»)? | UKBOOK, LEXICON:писати | PASS_SECOND_PASS |
| s7a-hist-galicia-sub-01-e04 | Данило Романович — син Романа Мстиславича, не угорський король. | Б: син Романа Мстиславича; Данило Романович — це: | HISTORY | PASS_SECOND_PASS |
| s7a-hist-galicia-sub-01-e06 | Коронація Данила традиційно датується 1253, а не 1199 роком. | А: 1253 р.; Коронація Данила Галицького як короля —: | HISTORY | PASS_SECOND_PASS |
| s7a-hist-galicia-sub-01-e07 | Галич і Волинь були окремими політичними центрами, не частинами Риму. | Б: окремими політичними центрами; До об’єднання Галич і Волинь були: | HISTORY | PASS_SECOND_PASS |
| s7a-hist-galicia-sub-01-e11 | Після загибелі Романа 1205 року тривала боротьба за спадщину, а не входження до Візантії. | Б: тривала боротьба за спадщину; Що відбувалося в Галицько-Волинській державі після загибелі Романа Мстиславича 1205 року? | HISTORY | PASS_SECOND_PASS |
| s7a-hist-galicia-sub-01-e12 | 1253 рік пов’язаний із королівським титулом Данила, а не хрещенням Русі. | Б: отримання королівського титулу; 1253 р. для Данила означає: | HISTORY | PASS_SECOND_PASS |
| s7a-bio-cell-sec-01-h02 | Велика центральна вакуоля характерна для рослинної клітини, не бактерій. | Б: рослин; Для клітин якої групи організмів типова велика центральна вакуоля, що підтримує тургор? | CELLS | PASS_SECOND_PASS |
| s7a-bio-cell-sec-01-m03 | Лізосоми забезпечують внутрішньоклітинне травлення у багатьох тваринних клітинах; у вірусів таких органел немає. | Б: тваринних клітин; Для яких клітин характерні лізосоми як органели внутрішньоклітинного розщеплення? | CELLS | PASS_SECOND_PASS |
| s7a-bio-cell-sec-01-m04 | Основна хромосомна ДНК прокаріотів міститься в нуклеоїді; хлоропластів у них немає. Плазмідна ДНК потребує уточнення умови. | Б: у нуклеоїді; Де локалізована основна хромосомна ДНК прокаріотичної клітини? | PROK | PASS_SECOND_PASS |
| s7a-zcode-biology-molecular-02-e03 | У РНК замість тиміну зазвичай міститься урацил, а не цитозин. | Б: урацил (U); У РНК замість тиміну входить: | RNA | PASS_SECOND_PASS |
| s7a-zcode-biology-molecular-02-m03 | Для диплоїдної материнської клітини мітоз зберігає плоїдність: дві 2n-клітини; не лише статеві клітини. Умову треба явно обмежити диплоїдною клітиною. | Б: дві однакові 2n-клітини; У нормальній моделі без мутацій після мітозу й цитокінезу диплоїдної клітини утворюються: | MITOSIS | PASS_SECOND_PASS |
| s7a-zcode-biology-molecular-02-m04 | Серед наведених процесів мейоз пов’язаний з утворенням гамет у тварин, не фотосинтезом. Умову варто обмежити тваринами: у рослин мейоз утворює спори. | Б: утворення статевих клітин; З яким із наведених процесів у тварин безпосередньо пов’язаний мейоз? | MEIOSIS | PASS_SECOND_PASS |
| s7a-cm-history-slavs-sub-01-e04 | Неправильний ключ поєднаний із нечітким або неточним очікуваним географічним/хронологічним формулюванням. | Б: Дністер і Дніпро; Які річки окреслюють землі антів за викладом Йордана, наведеним в Енциклопедії історії України? | ANTS | PASS_SECOND_PASS |
| s7a-cm-history-slavs-sub-01-e07 | Неправильний ключ поєднаний із нечітким або неточним очікуваним географічним/хронологічним формулюванням. | Б: Це слов’янське міжплемінне об’єднання; Ким були анти в історії ранньосередньовічних слов’ян? | ANTS | PASS_SECOND_PASS |
| s7a-cm-history-slavs-sub-01-e08 | Питання про етимологію містить недоведене або обернене запозичення; потрібна нова однозначна умова. | А: 602 р.; Яким роком датують останню писемну згадку про антів, пов’язану з походом аварів? | ANTS | PASS_SECOND_PASS |
| s7a-cm-history-slavs-sub-01-e11 | Неправильний ключ поєднаний із нечітким або неточним очікуваним географічним/хронологічним формулюванням. | Б: Йордан і Прокопій Кесарійський; Хто з наведених авторів VI століття повідомляв про антів? | ANTS | PASS_SECOND_PASS |
| s7a-ukr-ortho-sub-01-e12 | Неправильний ключ і необґрунтована сегментація кореня; перевірочне слово слід дібрати з явним наголосом. | А: ве́сни (називний відмінок множини); Яка форма перевіряє ненаголошений е в слові «весна́»? Наголос у варіантах позначено. | UKBOOK | PASS_SECOND_PASS |

## Sources and syllabus

Sources are expanded in final-24-source-review.json with access limitations. Official NMT program subject pages were re-opened. The items concern quadratic equations, lexicology/orthography, ancient Slavs and Galicia-Volhynia, cell organelles and cell division. They are training questions, not an assertion of complete exam coverage. The 602 date and early authors are supplementary; their inclusion in mandatory NMT lists is not asserted.

Independent math calculation: x²−7x+10=(x−2)(x−5); roots 2,5. D=9 gives the same roots; sum=7.

Five rewrites were not accepted verbatim: encyclopedia-reference phrasing was replaced by subject questions; geographical explanation no longer mentions distractors removed from its options. Biology prompts explicitly scope chromosome DNA, diploid mitosis and animal meiosis. The orthography gap no longer reveals the completed word.

## Additional observations

final-24-additional-review.json records 17 separate observations (including the generic lesson-quality flag), with overlap deduplicated. No additional IDs are added to the updater. Confirmed explanation errors and ambiguities remain candidates for a separate editorial batch. In particular water/earth stress, multiple stress-checking answers, Danylo's start date and гриб/грип need attention. The підручник wording remains a separate normative decision, not an automatically approved key fix. Fixing these 24 does not close the entire Stage 8 content audit.

## DB preflight and updater

All 24 question IDs and their original option rows still match the first review. Seven Topic full-row hashes match. TestQuestion=0, Answer=0, Mistake=0 for every target. Schema hash is pinned. The updater refuses stale rows/options/topics/schema, saved dependencies and mixed applied/unapplied states. The plan itself is pinned by SHA-256 in the script.

Default execution is read-only. Writing requires explicit --apply; working DB also requires --allow-working-db and separate owner permission. A fresh SQLite online backup is mandatory before writes, validated and atomically published by hard link without overwriting. After BEGIN IMMEDIATE the full DB must still match that backup. One transaction updates only the allowlisted rows, verifies all expected rows and unchanged tables, checks integrity/FK, then commits. Any unexpected condition rolls back, without retry or automatic restore. Repeating the fully applied plan is a no-op.

Safe current dry-run command:

```powershell
node scripts/stage8-fix-published-questions.mjs --database "D:/НМТ Сайт/NMT-academy/prisma/dev.db"
```

## Executed QA

- 40/40 targeted tests PASS; TypeScript, targeted ESLint and node --check PASS. Tests cover all final keys/distractors, stale hashes, existing dependencies, rollback on the final row and unexpected trigger changes, idempotency, WAL and backup name conflicts.
- Actual full online working-DB copy in a private Temp directory: dry-run 24 eligible; apply exactly 24 Question / 21 QuestionOption; all other 29 tables unchanged; integrity ok, FK 0; second apply no-op.
- Two actual competing updater processes on another QA copy: one update, second refused EEXIST before DB writes; backup retained original bytes/content.
- Working DB 31/31 tables unchanged throughout this task; no login, syncPlan, publication, import, migration or regrading.
- Browser/build not repeated: only offline updater, data candidates and tests changed; prior browser QA does not constitute review of these corrected prompts.

See final-24-updater-qa.json. Do not execute a working apply until the owner approves the exact correction plan and updater after review.

## Subsequent authorized working application

Owner approved application directly in chat on 2026-10-30. Applied once and independently read back: 24 Question / 21 QuestionOption.text; all other 29 tables unchanged, integrity ok, FK 0. See WORKING-24-RESULT.json. Earlier pending-approval statements above describe the pre-application review.
