# NMT Academy — статичний аудит коду

Дата: 18.10.2026. Репозиторій: C:/Users/User/nmt-academy.

## Висновок

Оболонка навчальної платформи реалізована значною мірою: є реальні сесії, рольові перевірки на сервері, власні результати й чернетки тестів, календар, повторення, редактори контенту, резервне копіювання та журнал. Водночас завершеність усіх сценаріїв не доведена. Найближчі ризики — редактор питань, відновлення чернеток і завершення тесту, зміна elective та запис спільних метаданих відео з дії учня.

Зафіксовано **15 знахідок: 7 P1 та 8 P2**. Серед них є відтворені чистими функціями помилки, доведені розриви коду, умовні ризики та ще не інтегровані заплановані можливості. Кожен тип позначено окремо.

У цьому проході **нічого не виправлялося, браузер не відкривався, до SQLite не підключався**. Немає твердження «всі кнопки працюють» або «витоків точно немає». Список матеріалів, якість уроків і кількість контенту не оцінювалися.

## Зафіксований стан і межі

- Commit: **a37d8cb27642ab8fe1982aaf5810f42e165856a5**, branch cursor/nmt-academy-lessons-and-audit.
- На початку tracked source чистий. Існувала незакомічена qa-audit/ зі скриншотами; її не змінював. У цьому проході додано тільки audit/.
- Основний аналіз читає Git blobs за SHA, тому інша робоча папка не підміняє ціль аналізу. Окремий worktree не створювався, git index/історія не змінювалися.
- Порівняльна гілка: feat/personalized-onboarding, SHA **506ceb6b1d3eabab4d9d0d69180ee8f0c6d2f36f**. Відносно основного commit: 14 комітів лише в основній гілці та 1 лише в onboarding. Вона не інтегрована.
- Початковий nmt-codex-audit-prompt.md не знайдено; власник повідомив, що не знає його шляху. Групи G1–G14 і гіпотези H01–H16 нижче сформовані за поточним повідомленням, а не оголошені точною копією невідомого файла. Відновлений промпт збережено окремо.
- Посилання файл:рядок нижче належать саме цьому commit. Для onboarding-гілки SHA/branch вказано окремо.

## Метод і перевірки

AST-first інвентар через встановлений TypeScript: 169 JS/TS файлів, 46 route entries (42 сторінки + 4 HTTP handlers), 55 module-level Server Actions та 11 inline server functions. Знайдено 406 JSX controls, з них 147 button/Button; це вихідні вузли reusable-компонентів, а не кількість видимих кнопок. AST виділив 564 виклики Prisma за підтриманим шаблоном, 347 із них у runtime src без test-файлів. Raw SQL й непрямі ownership-ланцюги перевірено окремо. Alias/callback/dynamic resolution не є повним compiler call graph; відсутність reference не є доказом невикористання.

| Перевірка | Результат поточного проходу |
|---|---|
| Прямий TypeScript compiler: --noEmit --incremental false | PASS, код 0, без tsbuildinfo |
| Локальний ESLint: src tests scripts prisma --no-cache, без fix | PASS, код 0 |
| Чисті функції із зафіксованого commit | Відтворено помилку round-trip питання й нормалізацію неможливої дати; контрольні role checks успішні |
| npm test | НЕ ЗАПУСКАВСЯ: fixtures створюють БД/файли й виконують db push/migrate, що заборонено цим проходом |
| npm run build / dev / start / e2e | НЕ ЗАПУСКАЛИСЯ |
| Prisma CLI, migrations, seed, upgrade | НЕ ЗАПУСКАЛИСЯ |
| Браузер / мережеві API / реальна БД | НЕ ПЕРЕВІРЯЛИСЯ |

Вивчено package.json, vitest.config.ts, tsconfig.json, eslint.config.mjs, AGENTS.md та документацію встановленої Next.js щодо Actions і authentication. Заміна npm run typecheck потрібна через incremental:true у конфігу. tests/db.test.ts:13–17 видаляє/створює test.db та викликає db push; tests/math-content-import.test.ts:9–18 створює disposable DB і запускає migrate deploy. Ізольованість цих тестів від dev.db не дає дозволу писати поза audit/ під час цього проходу.

Чистий harness не ініціалізує застосунок/Prisma. A02 відтворено так: correctAnswer='persisted-option-a', варіанти форми мають тільки label/text → prepareQuestion кидає «Правильна відповідь посилається на невідомий варіант». Контрольний ключ-мітка «А» проходить. Для дат 2026-02-31 перетворено в 2026-03-03. Дані синтетичні.

Попередня тимчасова помилка відсутнього question-moderation в цьому commit не підтвердилася: імпорт резолвиться, typecheck і lint проходять. Старі PASS тестів/збірки з попередніх робіт не видаються за перевірки цього commit.

## G1–G14: що є в коді та що ще не доведено

У всіх рядках «перевірено в браузері» = **ні**. CODE_PRESENT означає наявність реалізації та простеженого виклику, а не прийнятий UX.

| Група | Наявний шлях: route → component/action → дані/guard | Стан і наступна перевірка |
|---|---|---|
| G1 Авторизація, onboarding | /login → LoginForm/useActionState → login → password + Session; /onboarding → completeOnboarding → User/UserSubject/UserSettings. src/server/actions.ts:1151, :1185; src/server/session.ts:38 | CODE_PRESENT. Глобальний target та wizard є; resumable baseline/goals ще не інтегровані. H06 потребує runtime cookie-перевірки; A12/A14 перед публікацією. |
| G2 Головна, навігація | / → AppShell + user-scoped task/result/progress queries; main layout → session/onboarded → syncPlan. src/app/(main)/page.tsx:27; src/components/app-shell.tsx:29 | CODE_PRESENT. Безпідставний загальний redirect на / не знайдений; належить перевірити сесію, back/forward і рольові меню. A13 — навантаження read-path. |
| G3 Предмети, теми | /subjects, /subjects/[slug], /topics/[id] → requireUser; спільний Topic/Subject + особистий progress. src/app/(main)/learn/[topicId]/page.tsx:23 | CODE_PRESENT. Перевірити активні предмети, дерево підтем, not-found і переходи до lesson. Немає правила «без userId у спільного Topic = витік». |
| G4 Урок, відео | /learn/[topicId] → LessonTabs/MathText/VideoPanel/CompleteLesson → UserVideoProgress і verified bank. src/components/video-panel.tsx:12; src/server/actions.ts:192 | CODE_GAPS A09/A15. Empty-video повідомлення й original link є; підтримка плеєра/позиції не перевірена в Chrome. |
| G5 Практика, тести | startTopicTest/startExam → Test/TestQuestion/TestAttempt; TestRunner → saveDraft/finishAttempt → Answer/progress/XP. src/server/actions.ts:373, :452, :464 | CODE_GAPS A03–A05. У live runner правильні ключі не передаються до завершення; відновлення/таймер потребують негативних сценаріїв. |
| G6 Результати, прогрес | /results → ResultEditorDialog/ResultForm → saveExamResult; /analytics → own results/attempts/sessions. src/server/actions.ts:680; src/app/(main)/analytics/page.tsx:24 | CODE_PRESENT. Raw/rating/partial розділені, не вигадується рейтинг тестів. Перевірити edit/delete, періоди, empty state та великий обсяг даних (A13). |
| G7 Помилки, повторення, картки | /mistakes → setMistakeMeta; /review → completeReview/reviewFlashcard/saveFlashcard → own records. src/app/(main)/review/page.tsx:11; src/server/actions.ts:911 | CODE_PRESENT з A07: inline форми можуть приховати відмови. Перевірити збереження статусів, scheduling і повідомлення. |
| G8 План, календар | /calendar → TaskControls → setTaskStatus/moveTask/recalculateFuturePlan; syncPlan → StudyTask. src/components/task-controls.tsx:17; src/server/actions.ts:727 | CODE_GAPS A06/A07/A10/A13. Історія DONE/MOVED обробляється, але зміна elective й частина записів не атомарні. |
| G9 Конспекти, пошук | /notes → saveNote/deleteNote; /search → фільтри спільних тем. src/server/actions.ts:269, :285; src/app/(main)/notes/page.tsx:1 | CODE_PRESENT. Note update/delete мають userId. Потрібні A/B-перевірка, пошук, cancel/delete feedback, довгі тексти. |
| G10 Персональні налаштування | /settings → SettingsWorkspace + SettingsForm/changeElective. src/app/(main)/settings/page.tsx:16; src/components/settings-workspace.tsx:7 | CODE_PRESENT з A06/A08. Є profile view, навчання й тема, backup/roles/JSON config тут не монтуються. Ім'я/нік відображаються read-only; не називати це кнопкою редагування. |
| G11 Користувачі, ролі | /admin/users → RoleManager → updateUserRole → live actor/target + canManageRole. src/server/actions.ts:1398; src/lib/permissions.ts:1 | CODE_PRESENT. Ієрархія OWNER>ADMIN>EDITOR>STUDENT, початковий owner захищений; owner-sensitive зміни вимагають пароль і нік. Рольові runtime-набори ще не пройдені. |
| G12 Контент-адмінка | /admin та /editor → shared pages; editor()/auditedWrite/persistQuestion/verifyQuestion → shared content + AuditLog. src/server/actions.ts:296, :355 | CODE_GAPS A01/A02. Банки/фільтри/пагінація є; редагування використаного питання навмисно блокується для збереження історії. Потрібен зручний versioning flow окремо. |
| G13 Backup, журнал, інтеграції | /api/export/backup → owner(); restoreBackup → owner+confirmation+transaction; /admin/audit → пагінація/filter + role guard. src/server/actions.ts:1052, :1084; src/app/admin/audit/page.tsx:12 | CODE_PRESENT з A11. AI UI вимкнений (/ai-tutor redirect); наявний API вимагає session/provider, це не доказ глобального feature-off. Реальні ключі не читались. |
| G14 Інфраструктура, UX states | proxy + session + Prisma/WAL; 5 SQL migration files; design tokens, main loading/error, global not-found. src/proxy.ts:3; src/lib/prisma.ts:1; src/app/globals.css:1 | CODE_PRESENT, A10/A12–A14. Не вимірювалися швидкість/контраст/гідратація. Admin/editor власних error/loading boundaries не мають; це не автоматично баг, але негативні сценарії потрібні. |

## Знахідки

Priority: P1 — першочергово для відповідного сценарію/передумови; P2 — наступні покращення або підготовка до публічного запуску. P0, що доведений як поточна аварія/компрометація, не знайдено. Size: S — невелика локальна правка, M — кілька компонентів/перевірок, L — транзакційний або міжмодульний блок; це не оцінка календарного строку.

HIGH стосується доказу шляху в коді або синтетичного відтворення. Для CODE_RISK/CONDITIONAL_AUTHZ_GAP він не означає, що робочі дані вже пошкоджені. MEDIUM потребує runtime-підтвердження впливу.

| ID | Priority | Size | Confidence | Вид | Проблема | Evidence |
|---|---|---|---|---|---|---|
| A01 | P1 | M | HIGH | CODE_BUG | Редактор отримує посилання на відсутній /editor/questions/[id]. Наявний detail в /admin вимагає адміністратора; форма також повертає лише в /admin/questions. | src/app/admin/questions/page.tsx:22; src/app/admin/questions/page.tsx:70; src/app/admin/questions/[id]/page.tsx:11; src/components/forms.tsx:128 |
| A02 | P1 | M | HIGH | REPRODUCED_PURE | Під час редагування correctAnswer містить збережені option id, але ids варіантів втрачаються. prepareQuestion більше не може зіставити ключ. Підтверджено на синтетичному SINGLE_CHOICE без БД. | src/app/admin/questions/[id]/page.tsx:32; src/app/admin/questions/[id]/page.tsx:35; src/components/forms.tsx:108; src/lib/question-input.ts:5 |
| A03 | P1 | L | HIGH | CODE_RISK | finishAttempt записує відповіді, статус, помилки, прогрес і XP окремими операціями. Помилка посередині залишає частковий стан; немає атомарного захоплення IN_PROGRESS та ідемпотентного завершення. | src/server/actions.ts:471; src/server/actions.ts:473; src/server/actions.ts:497; src/server/actions.ts:521; src/server/actions.ts:533 |
| A04 | P1 | M | HIGH | CODE_BUG | Локальна чернетка записується, але не читається при відновленні. Результат saveDraft ігнорується, водночас текст постійно каже, що відповіді збережені. | src/components/test-runner.tsx:32; src/components/test-runner.tsx:55; src/components/test-runner.tsx:58; src/components/test-runner.tsx:123; src/server/actions.ts:452 |
| A05 | P1 | M | HIGH | CODE_BUG | Автозавершення за таймером не перевіряє result.ok: видаляє локальну чернетку навіть при бізнес-помилці й встановлює autoFinished без повторної спроби. Ручний шлях перевіряє результат. | src/components/test-runner.tsx:71; src/components/test-runner.tsx:74; src/components/test-runner.tsx:86 |
| A06 | P1 | M | HIGH | CODE_RISK | Зміна четвертого предмета окремо скасовує завдання, деактивує старий предмет, активує новий і змінює розклад. У разі проміжної помилки залишається частковий стан. Inline-форма відкидає повернуту помилку. | src/server/actions.ts:1289; src/server/actions.ts:1296; src/server/actions.ts:1303; src/app/(main)/settings/page.tsx:30 |
| A07 | P2 | M | HIGH | CODE_BUG | Частина кнопок календаря й inline-форм повторення ігнорує ActionState. Календар може перейти до теми після невдалого setTaskStatus; відмова додавання картки/повторення не показується. | src/components/task-controls.tsx:18; src/components/task-controls.tsx:27; src/app/(main)/review/page.tsx:39; src/app/(main)/review/page.tsx:44; src/app/(main)/review/page.tsx:69 |
| A08 | P2 | L | HIGH | PLANNED_FEATURE_GAP | Персональні цілі по предметах і окремий baseline не входять до основного commit. Там одна targetScore та старі чотири поля ваг; /baseline і /goals є тільки в окремій гілці. | src/app/(main)/settings/page.tsx:43; src/server/progress.ts:54; src/app/(main)/page.tsx:60; feat/personalized-onboarding:src/features/personal-plan/data.ts:26; feat/personalized-onboarding:src/app/(main)/goals/page.tsx:1 |
| A09 | P2 | S | HIGH | CODE_PRODUCT_GAP | Урок без перевірених питань не можна завершити з UI, хоча backend підтримує завершення після прапорця «конспект опрацьовано». Компонент needsPractice=false на цій сторінці не рендериться. | src/app/(main)/learn/[topicId]/page.tsx:71; src/components/lesson-tutor.tsx:114; src/server/actions.ts:599 |
| A10 | P2 | M | HIGH | REPRODUCED_PURE | Форма YYYY-MM-DD не гарантує календарну дату; parseDateKey нормалізує 2026-02-31 у 2026-03-03. createCustomTask не перевіряє дату та має лише Math.max для тривалості. | src/app/(main)/calendar/page.tsx:20; src/lib/dates.ts:11; src/server/actions.ts:759; src/server/actions.ts:792 |
| A11 | P2 | M | MEDIUM | CODE_RISK | JSON backup читає таблиці кількома запитами без спільної транзакції/знімка. Під час паралельних записів можливий неузгоджений набір таблиць. Реальну пошкоджену копію не створював. | src/server/actions.ts:1054; src/server/actions.ts:1055; src/server/actions.ts:1080 |
| A12 | P2 | M | HIGH | PUBLIC_RELEASE_RISK | Ліміт входу лише по ніку й у пам’яті процесу; створення профілю відкрите без invitation/rate-limit. Host-prefix у claimOwner не є перевіркою клієнтської мережі, але він додатково вимагає відсутній пароль owner. | src/lib/login-throttle.ts:2; src/server/actions.ts:1152; src/server/actions.ts:1198; src/server/actions.ts:1177 |
| A13 | P2 | M | MEDIUM | PERFORMANCE_RISK | Кожен render навчального layout викликає синхронізацію з потенційними записами; у перенесенні прострочених завдань є вкладені запити, а аналітика читає всю особисту історію й фільтрує її в JS. | src/app/(main)/layout.tsx:17; src/server/sync.ts:53; src/server/sync.ts:98; src/server/sync.ts:116; src/app/(main)/analytics/page.tsx:24 |
| A14 | P2 | S | HIGH | CODE_CONTRACT_GAP | Proxy перенаправляє запити без cookie до /login, включно з /api. Тому endpoint-контракт 401 JSON не виконується для відсутньої cookie; fetch може отримати HTML входу замість JSON. | src/proxy.ts:5; src/proxy.ts:6; src/app/api/ai/stream/route.ts:21; src/components/lesson-tutor.tsx:40 |
| A15 | P1 | M | HIGH | CONDITIONAL_AUTHZ_GAP | saveVideoPosition дозволяє будь-якому authenticated actor встановити durationSec у спільній VideoLesson, якщо тривалість порожня. Значення приходить від клієнта; воно не належить UserVideoProgress і надалі обмежує позицію для всіх користувачів. | src/server/actions.ts:192; src/server/actions.ts:194; src/server/actions.ts:197; src/server/actions.ts:199; prisma/schema.prisma:166 |

### A01: CODE_BUG

**Передумова/відтворення:** EDITOR → банк завдань → Редагувати.

**Запропонований напрям виправлення:** Додати editor detail з перевіркою редактора та спільний role-aware шлях повернення, не знімати guard адмін-layout.

**Acceptance:** EDITOR відкриває detail і повертається до /editor/questions; STUDENT не отримує доступу.

**Evidence:** `src/app/admin/questions/page.tsx:22`, `src/app/admin/questions/page.tsx:70`, `src/app/admin/questions/[id]/page.tsx:11`, `src/components/forms.tsx:128`.

### A02: REPRODUCED_PURE

**Передумова/відтворення:** Невикористане в тестах питання з варіантами → змінити лише формулювання → зберегти.

**Запропонований напрям виправлення:** Передавати ids варіантів або декодувати ключ у стабільні мітки; покрити round-trip SINGLE_CHOICE/MATCHING/SEQUENCE. Захист історії використаних питань зберегти.

**Acceptance:** Зміна тексту не вимагає ручного переписування правильного ключа; правильні відповіді після збереження не змінюються.

**Evidence:** `src/app/admin/questions/[id]/page.tsx:32`, `src/app/admin/questions/[id]/page.tsx:35`, `src/components/forms.tsx:108`, `src/lib/question-input.ts:5`.

### A03: CODE_RISK

**Передумова/відтворення:** Збій запису після кількох відповідей або два запити з різних вкладок. Реальний збій не інжектувався.

**Запропонований напрям виправлення:** Транзакційний перехід стану з умовою статусу, атомарне збереження результату та повторювані без дублювання побічні ефекти.

**Acceptance:** Fault-injection і два конкурентні завершення на disposable DB: жодних часткових відповідей чи подвійного XP.

**Evidence:** `src/server/actions.ts:471`, `src/server/actions.ts:473`, `src/server/actions.ts:497`, `src/server/actions.ts:521`, `src/server/actions.ts:533`.

### A04: CODE_BUG

**Передумова/відтворення:** Відповісти → втрата мережі або оновлення до завершення debounce 450 мс → відкрити тест знову.

**Запропонований напрям виправлення:** Відновлювати й узгоджувати локальну/серверну версії; показувати saving/saved/error, retry та обробляти відмову сервера.

**Acceptance:** Offline/reload і швидкий reload зберігають відповіді; UI не повідомляє про успіх при відмові saveDraft.

**Evidence:** `src/components/test-runner.tsx:32`, `src/components/test-runner.tsx:55`, `src/components/test-runner.tsx:58`, `src/components/test-runner.tsx:123`, `src/server/actions.ts:452`.

### A05: CODE_BUG

**Передумова/відтворення:** Таймер завершився, finishAttempt повернув {ok:false} або відхилив Promise.

**Запропонований напрям виправлення:** Одна процедура ручного та автоматичного завершення з перевіркою результату, catch/retry і видаленням чернетки тільки після успіху.

**Acceptance:** При помилці таймера чернетка залишається, є повідомлення та повторна спроба.

**Evidence:** `src/components/test-runner.tsx:71`, `src/components/test-runner.tsx:74`, `src/components/test-runner.tsx:86`.

### A06: CODE_RISK

**Передумова/відтворення:** Помилка між деактивацією старого предмета й завершенням оновлення; unchecked confirmation також дає непоказану помилку.

**Запропонований напрям виправлення:** Атомарно змінити вибір та конфігурацію; керований перерахунок після commit; повертати стан форми через useActionState/клієнтський wrapper.

**Acceptance:** Є рівно один активний elective; при збоях старий стан зберігається; помилка видима; історія DONE не змінюється.

**Evidence:** `src/server/actions.ts:1289`, `src/server/actions.ts:1296`, `src/server/actions.ts:1303`, `src/app/(main)/settings/page.tsx:30`.

### A07: CODE_BUG

**Передумова/відтворення:** Сервер повернув {ok:false}; кнопку натиснуто двічі; невалідні/застарілі дані.

**Запропонований напрям виправлення:** Уніфікувати pending/error/success та блокувати дублікати; переходити лише після успіху.

**Acceptance:** Для кожної форми негативний сценарій дає видиме повідомлення й не створює хибного переходу.

**Evidence:** `src/components/task-controls.tsx:18`, `src/components/task-controls.tsx:27`, `src/app/(main)/review/page.tsx:39`, `src/app/(main)/review/page.tsx:44`, `src/app/(main)/review/page.tsx:69`.

### A08: PLANNED_FEATURE_GAP

**Передумова/відтворення:** Очікування повного персоналізованого шляху й цілей для довільного четвертого предмета.

**Запропонований напрям виправлення:** Окремий контрольований перенос контракту персоналізації; не замінювати основний код старою гілкою цілком; узгодити адитивну міграцію з поточною історією.

**Acceptance:** Шлях onboarding → baseline/skip → goals → plan завершено, активний elective має власну ціль і вагу; старий контент/ролі збережені.

**Evidence:** `src/app/(main)/settings/page.tsx:43`, `src/server/progress.ts:54`, `src/app/(main)/page.tsx:60`, `feat/personalized-onboarding:src/features/personal-plan/data.ts:26`, `feat/personalized-onboarding:src/app/(main)/goals/page.tsx:1`.

### A09: CODE_PRODUCT_GAP

**Передумова/відтворення:** Є теорія, але 0 VERIFIED питань — типовий empty-state.

**Запропонований напрям виправлення:** Узгодити продуктове правило: дозволити відмітку читання без mastery або явно прибрати цей серверний сценарій та надати корисний наступний крок.

**Acceptance:** Відсутність практики не створює прихованого тупика; прочитаний урок і засвоєна тема розрізняються.

**Evidence:** `src/app/(main)/learn/[topicId]/page.tsx:71`, `src/components/lesson-tutor.tsx:114`, `src/server/actions.ts:599`.

### A10: REPRODUCED_PURE

**Передумова/відтворення:** Підмінений query/date або прямий виклик action з некоректним значенням; звичайний date input може це обмежити, але серверна межа лишається.

**Запропонований напрям виправлення:** Єдина схема валідної дати з round-trip, цілого обмеженого duration та enum kind на сервері й у query.

**Acceptance:** Неможливі дати відхиляються з поясненням; вони не тихо переносяться на інший день.

**Evidence:** `src/app/(main)/calendar/page.tsx:20`, `src/lib/dates.ts:11`, `src/server/actions.ts:759`, `src/server/actions.ts:792`.

### A11: CODE_RISK

**Передумова/відтворення:** Учень або редактор змінює пов’язані записи між читанням таблиць.

**Запропонований напрям виправлення:** Консистентний snapshot/read transaction та перевірка відновлення на окремій базі; власницький guard зберегти.

**Acceptance:** Конкурентне створення даних під час backup не порушує FK і кількості зв’язків після restore.

**Evidence:** `src/server/actions.ts:1054`, `src/server/actions.ts:1055`, `src/server/actions.ts:1080`.

### A12: PUBLIC_RELEASE_RISK

**Передумова/відтворення:** Публічна мережа/початкове незахищене налаштування. Це не доказ поточної компрометації локального сайту.

**Запропонований напрям виправлення:** Перед публікацією: ліміт по IP+акаунту, контроль реєстрації та одноразовий явний bootstrap owner. Не застосовувати ці зміни під час аудиту.

**Acceptance:** Не можна масово створювати профілі/блокувати довільний нік без загального ліміту; bootstrap закритий після налаштування.

**Evidence:** `src/lib/login-throttle.ts:2`, `src/server/actions.ts:1152`, `src/server/actions.ts:1198`, `src/server/actions.ts:1177`.

### A13: PERFORMANCE_RISK

**Передумова/відтворення:** Багато прострочених завдань/велика історія/паралельні вкладки. Фактичний час відповіді в цьому проході не вимірювався.

**Запропонований напрям виправлення:** Профілювати окремо; винести синхронізацію з read-path або обмежити її версією; агрегати та діапазони рахувати в SQL, прибрати N+1.

**Acceptance:** Звичайна навігація не потребує перерахунку всього плану; кількість запитів і p95 зафіксовані на контрольному наборі.

**Evidence:** `src/app/(main)/layout.tsx:17`, `src/server/sync.ts:53`, `src/server/sync.ts:98`, `src/server/sync.ts:116`, `src/app/(main)/analytics/page.tsx:24`.

### A14: CODE_CONTRACT_GAP

**Передумова/відтворення:** Клієнтський API-запит після видалення/закінчення cookie. Невалідна, але присутня cookie доходить до API-guard й дає іншу поведінку.

**Запропонований напрям виправлення:** Для /api повертати узгоджений 401 JSON або залишати auth response endpoint; сторінковий redirect зберегти.

**Acceptance:** Відсутня, прострочена та підроблена cookie мають передбачувану API-відповідь без HTML-помилки парсингу.

**Evidence:** `src/proxy.ts:5`, `src/proxy.ts:6`, `src/app/api/ai/stream/route.ts:21`, `src/components/lesson-tutor.tsx:40`.

### A15: CONDITIONAL_AUTHZ_GAP

**Передумова/відтворення:** STUDENT передає довільну додатну durationSec для відео без тривалості. Наявність таких записів у робочій БД не перевірялася; жодної зміни не виконано.

**Запропонований напрям виправлення:** Особиста позиція має змінювати лише UserVideoProgress; спільну тривалість отримувати з довіреного джерела або зберігати через editor-only дію. Валідувати часову межу незалежно від неперевіреного клієнта.

**Acceptance:** На disposable fixture учень може зберегти свою позицію, але не може підмінити спільну тривалість; редактор може оновити метадані через окремий дозволений сценарій.

**Evidence:** `src/server/actions.ts:192`, `src/server/actions.ts:194`, `src/server/actions.ts:197`, `src/server/actions.ts:199`, `prisma/schema.prisma:166`.


## Перевірка 16 робочих гіпотез

Це набір поточного аудиту, а не заявлена перевірка відсутнього списку з початкового промпта.

| ID | Гіпотеза | Висновок і confidence | Підстава |
|---|---|---|---|
| H01 | Навігація безпідставно скидає на головну | REQUIRES_RUNTIME / MEDIUM | Загальний redirect-all не знайдений; /ai-tutor навмисно redirect /, login/requireUser мають штатні redirect. src/app/(main)/ai-tutor/page.tsx:6; src/server/session.ts:53 |
| H02 | Ролі захищені тільки UI | REFUTED_IN_CODE / HIGH для простежених операцій | actor/administrator/editor/owner + guards кожного API. Виняток shared duration — A15; це не повна сертифікація всіх прав. |
| H03 | Учень отримує повний backup | REFUTED_IN_CODE / HIGH | isOwner в API й owner() у buildBackup; runtime 403 ще не перевірено. src/app/api/export/backup/route.ts:10; src/server/actions.ts:1053 |
| H04 | Editor edit-path існує | REFUTED_IN_CODE / HIGH | A01: посилання є, маршруту немає. |
| H05 | Редагування питання зберігає option keys | REFUTED_PURE_PROBE / HIGH | A02, pure-probes.json. |
| H06 | Cookie/авторизація однаково працюють локально та у production | REQUIRES_RUNTIME / MEDIUM | session-cookie.ts вмикає Secure за NODE_ENV production, є override. .env не читався; LAN HTTP не тестувався. |
| H07 | Чернетка переживає offline/reload | CODE_GAP / HIGH | A04: localStorage не зчитується, відповідь saveDraft відкидається. |
| H08 | Таймер обробляє відмову завершення | REFUTED_IN_CODE / HIGH | A05. |
| H09 | Завершення атомарне та ідемпотентне | REFUTED_IN_CODE / HIGH | A03. |
| H10 | Помилки календарних кнопок видимі | PARTIAL / HIGH | moveTask відображає result, start/done — ні (A07). |
| H11 | Elective змінюється атомарно зі збереженням історії | PARTIAL / HIGH | DONE не вибирається для скасування, але загальної транзакції немає (A06). |
| H12 | Baseline/goals інтегровані | REFUTED_IN_CODE / HIGH | A08; окремий SHA гілки. |
| H13 | Відсутній прямий handler означає no-op | REFUTED / HIGH | GET-фільтри, form submit, Radix Close/Slot; див. ui-control-review.md. |
| H14 | Guard успадковується й враховує re-export | CONFIRMED_IN_CODE / HIGH для mapped pages | Admin/editor layout, shared page implementation; для HTTP handlers layout не враховується. |
| H15 | A/B ізольовані й учень не змінює shared metadata | PARTIAL | Прямого міжучнівського витоку в простежених приватних операціях не знайдено; A/B runtime не виконано. A15 — доведений умовний shared-write gap. |
| H16 | Поточний commit проходить безпечні статичні перевірки | CONFIRMED / HIGH у межах команд | typecheck й lint PASS; DB-тести/production build не запускалися. |

## Власність даних і межі ролей

Окрема [таблиця ownership-кандидатів](ownership-query-review.md) містить 78 runtime-викликів, де в аргументі немає буквального userId, включно з Answer/AIMessage. Їх не названо витоками:

- Батьківська TestAttempt перевіряється за id + userId перед роботою з Answer; нотатки, результати, прогрес і завдання мають actor/userId на write/read межах.
- Об'єкти where/mine розгортаються в приватні запити. Внутрішні id у планувальнику походять із user-scoped вибірки, не приймаються з клієнта.
- Повна вибірка backup/restore — OWNER-only; адміністративний список завдань — ADMIN-wide згідно з фактичною політикою. Це окрема рольова можливість, не student-to-student доступ.
- Session знаходиться/видаляється за хешем cookie token, що є межею авторизації; passwordHash прибраний із session user. Login використовує параметризований SQL.
- Шаблони досягнень спільні, персональні записи мають namespaced id; getSettings без сесії має default fallback — техборг, але helper не є публічною Server Action.

Важливо: A15 знайдено саме при перевірці **shared** моделі, яку неможливо перевіряти тільки правилом «є userId чи ні». Особисте відео-положення ізольоване; тривалість змінюється в спільній VideoLesson за умовою.

Схема містить nullable userId та не має User FK у частині legacy особистих моделей (наприклад Note/TestAttempt/ExamResult/StudyTask). Стан orphan records у живій БД **невідомий**, попередню цифру 0 не перевіряв. Планувати окрему адитивну міграцію після інвентаризації; не виконувати тут.

Full JSON backup містить users із passwordHash (src/server/actions.ts:1054). Це не unauthenticated endpoint і не випадкова передача учню, але файл є чутливим. Ключі з data/secrets.json у нього не включаються. Restore зберігає живий журнал і не відтворює архівні audit-події як нові (src/server/actions.ts:1140); потрібна явна документація цієї семантики.

## Окрема гілка персоналізації: що не можна вважати готовим в основній

У 506ceb6 є /baseline, /goals, src/features/onboarding та src/features/personal-plan, цілі на UserSubject, isBaseline/baselineKey і збережений onboardingStep/planVersion. src/features/personal-plan/data.ts:26 збирає user-scoped summary. Це реально наявний код окремої гілки; її тести/збірку цього разу не запускав.

У a37d8cb цих маршрутів і schema fields немає. Є старий wizard, один загальний targetScore, діагностичний тест/skip і фіксовані поля пріоритетів. Відсутність окремого baseline не можна підміняти вручну записаним звичайним результатом без нової семантики.

Не зливати стару гілку поверх основного дерева цілком: вона розходиться з 14 основними комітами, а schema/actions/session/sync/UI й міграції відрізняються. Потрібен перенос контракту з утриманням нових ролей, hardening, журналу та математичних чернеток.

**Окремий ризик історії міграцій:** адитивний файл гілки 20261017220000_personalized_onboarding_additive починається з ALTER TABLE User (рядок 1), тоді як в основній історії User створюється лише у 20261018000000_reconcile_history/migration.sql:39; у init CREATE TABLE User немає. Не копіювати старе timestamp-ім'я в основний ланцюг як готове рішення для fresh deploy. Узгодити порядок/стратегію й перевірити весь migrate deploy на новій disposable DB **на етапі інтеграції**. У цьому аудиті не перевіряв фактичний deploy і не змінював SQL.

## Продуктивність, інтеграції, дизайн і відхилені хибні знахідки

- A13 — ризик зростання кількості запитів, не виміряний «сайт повільний». Наявність індексів не замінює профілювання.
- У source 5 міграцій, включно з nickname COLLATE NOCASE. Стан _prisma_migrations, drift, integrity_check і фактичний режим WAL живої БД не перевірявся. Додатковий collation index має входити до майбутньої перевірки schema diff на копії.
- src/lib/prisma.ts при імпорті запускає initializeSQLite. Тому для read-only аудиту застосунок/Prisma не імпортувався. Backup/restore читає JSON через Prisma, не копіює голий .db; ризик непослідовного snapshot описаний A11.
- AI прихований у поточній оболонці, але HTTP API лишився з перевіркою provider. raw error.message в src/app/api/ai/stream/route.ts:45, :56 потребує окремого узгодження безпечного контракту. Це не доводить наявності витоку ключів. Секрети не читалися, запити провайдерам не відправлялися.
- GET backup пише audit-подію (src/server/actions.ts:1079), тому не є read-only перевіркою навіть за HTTP GET.
- Виявлений AST-кандидат «Скасувати» у result-editor-dialog.tsx:26 має Dialog.Close asChild; він не мертвий. GET-фільтри адмінки теж не no-op.
- Запити спільних Subject/Topic/Question без userId не є автоматичним IDOR. /login, dynamic pages і redirect targets не названо сиротами через відсутність прямої sidebar-ссылки.
- /ai-tutor → / і /editor → /editor/lessons — явні redirect за кодом, не доведений збій сесії.
- CSS tokens, responsive classes, lang=uk, loading/error/empty states є; контраст, фокус, overlap, mobile scroll і якість макета не підтверджуються статичним читанням. У root є darkreader-lock і suppressHydrationWarning; це не доказ зникнення всіх hydration warnings. Chrome-прохід — без style extensions, потім окремо контроль із ними.

## Наступний Chrome-прохід і backlog

Вони **підготовлені, але не виконані**:

- [Chrome-checklist.md](Chrome-checklist.md): шість тестових ідентичностей, негативні сценарії, API, A/B ownership, сквозний шлях.
- [Chrome-route-role-matrix.csv](Chrome-route-role-matrix.csv): 504 початкові комбінації 42 сторінок × 6 ідентичностей × 2 ширини. Для динамічних маршрутів підставити відомі QA ids. CSV містить очікування за кодом, не позначку «пройдено»; empty/error/permission variants доповнює checklist.
- [backlog.md](backlog.md): 8 блоків із acceptance. Нічого з них не реалізовано в цьому проході.

## Артефакти і незмінність

Головний звіт — цей файл. Додатки: baseline.json, final-state.json, checks.json, AST-maps.json, route-map.md, action-map.md, ui-control-review.md, findings.json, ownership-query-review.md/.json, pure-probes.json, branch-diff-stat.txt, nmt-codex-audit-prompt.md, Chrome-checklist.md, Chrome-route-role-matrix.csv, backlog.md. Аналітичні скрипти лежать у тій самій audit/.

Підсумкова перевірка: HEAD не змінився; tracked diff від baseline порожній; staged changes порожні; SHA onboarding-гілки не змінився. git status містить тільки нову audit/ і попередню qa-audit/. Ніяких fix/commit/migrate команд не виконувалось. Ця перевірка стосується source та Git state; байтову незмінність живої SQLite під діями інших процесів не вимірював.

Аудит не є release approval. Стан «прийнято в Chrome», «перевірено на двох учнях», «міграції застосовані до робочої БД» і «production build PASS» для цього commit тут не заявляється. Наступний етап — перевірити цей список у Chrome на підготовленому QA-середовищі, після чого погоджувати окремі блоки виправлень.
