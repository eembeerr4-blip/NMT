# D04 FINAL — завершення й приймання навчального уроку

Дата: 20.10.2026. Статус: **готово до візуального приймання власником** з окремим SKIPPED для справжнього зовнішнього відео. Робочий сайт не оновлювався; merge, push і D05 не виконувалися.

## Git і безпечна основа

- Прийнятий D03.1: `c2fef68d8dd8072a522417aef1cae9589c9305c0`.
- Фактичний завершений HEAD D03.1: `0dc512e7fdf5693f72899ca74babbc1298026eb6`. Наступний після реалізації коміт лише документує її SHA. Дерево D03.1 перед відгалуженням чисте.
- Цей HEAD уже містив D01–D04; урок не створювався заново, cherry-pick/merge не застосовувалися.
- Нова гілка: `codex/d04-final`.
- Новий worktree: `D:/Вайб-кодинг/nmt-d04-final`.
- Фінальний SHA реалізації: **`9badc6d7989df53b2b4be91a17beef1b4538b59e`**. Наступний коміт лише вписує цей SHA у звіт; його HEAD можна отримати через `git rev-parse codex/d04-final`. Код і зібраний QA runtime відповідають SHA реалізації.
- Прочитані `docs/D04.md`, `docs/D03.1.md`, `docs/D03.md`, AGENTS і встановлений Next.js server/client guide.

Окремий production QA-сервер: **http://127.0.0.1:3212/learn/qa-linear**. Він слухає тільки loopback. База: `audit/d04-final/lesson-final-qa.db`. Це новий snapshot через `VACUUM INTO` з read-only з'єднання синтетичної QA-бази D03.1, а не робочої SQLite. Робоча база та `.env` не читалися/не копіювалися. Немає migrate, db push, seed, reset, restore, встановлення залежностей або змін схеми.

QA runtime, база, WAL/SHM, журнали й скриншоти виключені з Git через `/audit/d04-final/`. Вони залишаються локально для приймання. Вхідні синтетичні матеріали збережені; нових уроків або запитань для цього завдання не генерували.

## Що залишалося недоробленим

1. Основні чотири вкладки D04 уже працювали, але розкриті форми особистих нотаток мали старі відступи та дрібні кнопки.
2. Блок нотаток до відео не мав чіткого окремого заголовка й узгоджених відступів.
3. Реальна практика відкривала чинний `/tests/[id]`: його runner, результат, підтвердження завершення та вкладена форма повідомлення про помилку повертали старе оформлення.
4. У QuestionFeedback відмова мережі могла вийти необробленим rejected promise; повідомлення й зрозумілого повтору не було.

## Внесені зміни

- Особисті нотатки: оформлені закриті/відкриті панелі, chevron, поля, кнопки від 44 px, textarea, pending/success/error. Використовується попередній NoteForm; збереження не переписувалося.
- Відеонотатки: необов'язковий presentation-прапорець тільки для lesson variant; заголовок «Мої нотатки до відео». Ефекти плеєра, ключі компонентів, позиція та save handlers залишилися попередніми.
- Лише тематична практика `kind === TOPIC` з реальним topicId отримала `.d04f-practice`, оформлення D01 та справжній backlink «До уроку» як у runner, так і в результаті. Це завершення вкладеного сценарію D04; глобальний редизайн тестів D05 не розпочинався. EXAM/DIAGNOSTIC не підключені до нового оформлення.
- CSS узгоджує умови, формули, radio/select/input, порядок відповідей, навігацію, підтвердження завершення, error/retry, результат і форму повідомлення про помилку.
- QuestionFeedback переведено на чинний `useActionFeedback`: текст залишається при збої, під час pending повторний submit заблокований, очищення відбувається тільки після успіху. Виклик `reportQuestion(id, issue)` залишився тим самим. Обробка відмови сумісна з іншими споживачами компонента; новий CSS обмежений тематичною практикою.
- Під час візуального QA уточнено selector через чинну motion-обгортку main. Також звужено стилізацію карток до `div.bg-card`: інакше мобільний padding потрапляв на select та обрізав текст. Виправлення перевірене скриншотом і вимірюванням внутрішньої висоти полів.

## Змінені файли

| Файл | Призначення |
|---|---|
| `.gitignore` | Ізоляція локальних QA-артефактів |
| `src/app/(main)/tests/[id]/page.tsx` | Presentation-маркер та backlink тільки для TOPIC |
| `src/app/globals.css` | Локальні вкладені форми уроку та тематична практика |
| `src/components/video-panel.tsx` | Presentation нотаток до відео |
| `src/components/question-feedback.tsx` | UI pending/error/retry без зміни action |
| `src/components/lesson/practice-surface.test.ts` | 6 unit/mock перевірок контрактів |
| `docs/D04-final.md` | Цей звіт |

У `src/server`, `src/lib`, `prisma`, TestRunner та use-attempt-draft **нуль змін**. AST-порівняння з базовим SHA підтверджує: усі три inline Server Actions на сторінці спроби та JSX-виклик TestRunner з його key/props незмінні, з нормалізацією лише CRLF/LF. Доказ: `audit/d04-final/protected-contracts.json`.

## Порівняння з екраном №4

Еталон: `C:/Users/User/nmt-academy/audit/D00/reference/approved-16-screens.png`, основний орієнтир — екран №4, спільна оболонка прийнятих D01–D03.1.

Збережені темна синя поверхня, предметний заголовок, компактна навігація, синя активна вкладка, радіуси, тонкі рамки й контрастна основна дія. Теорія/відео та конспект/особисті записи використовують дві колонки на desktop й одну на mobile. Приклади та практика продовжують ті самі поверхні, типографіку й стани. Розкриті форми більше не випадають із цього стилю.

Макет не копіюється декоративними контролами: плеєр тільки для наявного підтвердженого відео; без питань тест disabled з поясненням; дані, статус і сусідні теми реальні для QA snapshot. Точна піксельна тотожність колажу не заявляється.

## Перевірки коду

| Перевірка | Результат |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS |
| `npm run lint` — eslint без `--fix` | PASS |
| Вибрані 16 безпечних pure/unit/mock файлів | **100/100 PASS** |
| `node node_modules/next/dist/bin/next build` з QA DATABASE_URL | PASS; фінальна збірка після виправлення padding |
| `git diff --check` | PASS |
| QA `PRAGMA integrity_check` | `ok` |
| QA `PRAGMA foreign_key_check` | порожньо |

100 тестів охоплюють прийняті D01–D03.1, D04 presentation/page/completion, scoring, draft, permissions, question input, lessonAccess та шість нових перевірок тематичної поверхні. Нові тести замокають сесію, Prisma, settings, actions і runner; робочої БД не використовують. Повний `npm test` та старий e2e setup не запускалися. `npm run build` не використовувався, бо він містить `prisma generate`; запущено безпосередньо Next production build.

## Chrome QA

Встановлений Google Chrome через Playwright, окремі contexts для STUDENT_A/B та ролей; додатково відкрита видима QA-вкладка Chrome для власника. Підсумок: **29 унікальних згрупованих сценаріїв PASS, 0 остаточних FAIL**. Деталі: `audit/d04-final/acceptance-summary.json` та `qa-*.json`.

| Сценарій | Фактичний результат |
|---|---|
| Предмети → Математика → тема → урок → усі вкладки → огляд теми | PASS, справжні посилання й URL |
| Теорія, Приклади, Практика, Конспект; клавіатура ArrowRight/End | PASS |
| Введений текст Note/відеонотаток при поверненні на вкладку | PASS, не втрачений |
| Створення Note: transport error → збережений текст → retry → reload | PASS |
| Редагування Note: затриманий POST/pending lock → success → reload | PASS, topicId та власник збережені |
| Відеонотатки: error/retry → reload | PASS, приватні для поточного учня |
| A/B: особисті нотатки, посилання на результати, позиції відео | PASS, дані A не з'явилися в B |
| Прямий URL спроби A під B | PASS: «Сторінку не знайдено», жодного runner/результату A |
| ANON → урок | PASS, перенаправлення на login |
| Завершення теорії: validation → error/retry → reload | PASS: A `IN_PROGRESS`, не `MASTERED`; B `NOT_STARTED` |
| Без відео/питань/прикладів/короткого конспекту; недоступна тема | PASS, чесні порожні стани |
| Перехід до реальної наступної теми з пропуском недоступної | PASS |
| Недоступний YouTube: fallback/original link, інші вкладки працюють | PASS, навмисний мережевий збій |
| Продовження відео з mock YouTube API | PASS: реальний saveVideoPosition, A=257 с після reload; B не змінено; при перемиканні вкладок плеєр не перемонтований |
| NUMERIC, SINGLE_CHOICE, MATCHING, SEQUENCE | PASS: заповнення реальних QA question/option ID, усі 7 відповідей |
| Чернетка → reload → finish fault → retry → результат → back/forward | PASS: draft збережений, при відмові IN_PROGRESS, після retry COMPLETED **7/7** |
| Повідомлення про помилку питання: fault → текст залишився → retry | PASS: реальний action, success очищає поле |
| OWNER/ADMIN/EDITOR відкривають навчальний урок | PASS: 4 вкладки, без редакторських відеоконтролів та нотаток A |
| Desktop 1440×900, 1920×1080; mobile 390×844, 360×800 | PASS для всіх вкладок, відкритих нотаток, довгих формул і практики |
| Кожен наявний тип питання + результат/report на 390/360, dark/light | PASS, поля не обрізаються, targets від 44 px |
| Dark/light/system; перемикання теми, drawer/Escape, нижній backlink | PASS |
| Horizontal overflow з тимчасово видимим overflowX root/body | не виявлений |
| Нові hydration/runtime/неочікувані мережеві помилки застосунку | не виявлені у фінальних перевірках |

У початковому тестовому harness були неоднозначний selector дубльованого посилання, перевірки до завершення переходу та два винятки init-script localStorage у sandboxed YouTube iframe. Harness обмежено власним origin, очікування уточнені, відповідні сценарії повторені. Початкові невдалі результати залишені в `qa-initial.json`/`qa-extra-initial.json`; виправлення harness не видаються за виправлення застосунку. Повтори `qa-retry.json`, `qa-practice-retry.json`, `qa-extra.json` і фінальне захоплення практики не мають неочікуваних issues.

Next streaming повернув HTTP 200 для чужої спроби, після чого показав чинний notFound. Доступ не наданий; твердження про HTTP 404 не робиться. Guard та відповідь сервера не змінювалися.

## Дані та регресія D01–D03.1

QA integrity/FK перевірені після записів. Subject (12), Topic (32), QuestionOption (6), VideoLesson (1) повністю збігаються зі snapshot. Question (7) зберегли зміст, правильні відповіді й пояснення; тільки `issueReport`/`updatedAt` одного питання очікувано змінені через реальну перевірку reportQuestion. Інші очікувані записи — особисті QA Note, draft/attempt/progress/video position. Доказ: `content-check.json`.

Before/after зроблені до функціональних записів: по 76 зображень. Для регресії окремо зафіксовано 32 пари: головна, curriculum personal/free/materials, каталог, математика, огляд теми, календар × 1440/390 × dark/light. Джерела цих сторінок і глобальні токени не змінено; основні пари візуально зіставлені. PNG hashes збіглися лише в 1/32 пар: через відмінності рендеру/анімації **піксельну ідентичність не заявляю**. Таблиця всіх пар — `regression.json`. Фінальні 8 зображень runner/result оновлені після останнього CSS-виправлення.

Вісім попередніх worktree мають попередні HEAD і нуль tracked changes — `other-worktrees.json`. Їхні сервери не перезапускалися. У цьому завданні перезапускався лише власний QA-процес на 3212.

## Скриншоти для приймання

У `audit/d04-final/screens/` — 262 локальні PNG, включно з before/after та функціональними станами. Повний перелік — `audit/d04-final/screenshots.md`. Це синтетичні QA-дані, не навчальний контент для публікації.

### Чотири вкладки, desktop

![Теорія](../audit/d04-final/screens/after-1440-dark-lesson-Теорія.png)

![Приклади](../audit/d04-final/screens/after-1440-dark-lesson-Приклади.png)

![Практика](../audit/d04-final/screens/after-1440-dark-lesson-Практика.png)

![Конспект](../audit/d04-final/screens/after-1440-dark-lesson-Конспект.png)

### Вкладені форми, mobile та відмови

- `screens/after-390-light-note-create-expanded.png`, `after-1440-dark-note-edit-expanded.png` — розкриті форми.
- `screens/qa-note-create-error.png`, `qa-note-create-success.png`, `qa-note-edit-pending.png` — error/success/pending Note.
- `screens/qa-video-notes-error.png`, `qa-video-notes-success.png`, `qa-completion-error.png`, `qa-completion-success.png`.
- `screens/qa-question-{NUMERIC,SINGLE_CHOICE,MATCHING,SEQUENCE}-{before,answered}.png` — до/після відповіді.
- `screens/qa-finish-confirm.png`, `qa-finish-network-error.png`, `qa-practice-result.png` — справжній цикл практики.
- `screens/qa-report-network-error.png`, `qa-report-success.png`, `qa-foreign-attempt-denied.png`.
- `screens/qa-tabs-{1440,1920,390,360}-{dark,light}-{Теорія,Приклади,Практика,Конспект}.png`.
- `screens/qa-mobile-{390,360}-{dark,light}-{NUMERIC,SINGLE_CHOICE,MATCHING,SEQUENCE,result-report}.png` — фінальні мобільні контролі.
- `screens/qa-math-long-{1440,1920,390,360}-{dark,light}-{Теорія,Приклади}.png`.
- `screens/qa-no-practice.png`, `qa-no-examples.png`, `qa-no-synopsis.png`, `qa-unavailable.png`.

Префікс кожного файла — `audit/d04-final/`. Шаблони у фігурних дужках позначають існуючі варіанти; точні імена перелічені в screenshots.md.

## Обмеження та SKIPPED

- **SKIPPED: справжнє зовнішнє YouTube-відтворення.** QA youtubeId синтетичний/недоступний, зовнішня мережа обмежена. Перевірені fallback і mock API wiring через справжній server action; це не доказ відтворення реального ролика.
- Сумарний час перегляду та окреме автозбереження незбереженої Note після повного reload не додані: таких контрактів немає. Перемикання вкладок зберігає введений текст; reload зберігає вже записані нотатки.
- На цьому snapshot є чотири типи питань. SHORT_TEXT/STEP_BY_STEP не заявлені як пройдені живим браузером; контракти їхнього input/scoring не змінено.
- Валідація якості та повноти навчального контенту, інтеграція onboarding, редизайн EXAM/DIAGNOSTIC/інших сторінок не входили до D04 FINAL.
- Це локальна QA-приймальна версія. Остаточну візуальну прийомку та дозволи на інтеграцію дає власник. До того merge/push, оновлення робочого сайту та D05 не виконуються.
