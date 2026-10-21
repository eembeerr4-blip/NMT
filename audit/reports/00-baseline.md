# Этап 0 — контрольная точка

Дата: 18.10.2026. Исходный SHA **4b5ce391375728503c75405a739b154d849e94f7**.
Основной каталог C:/Users/User/nmt-academy, ветка cursor/nmt-academy-lessons-and-audit.
Рабочий каталог проверки D:/Вайб-кодинг/nmt-beta, ветка beta/00-baseline.
От a37d8cb до исходного HEAD: 3 коммита. Отслеживаемые файлы исходного каталога чистые; чужие audit/ и qa-audit/ сохранены.

## Наличие исправлений

Все C01–C09 присутствуют в основном HEAD; реализация 2b6e7a2, конфигурация 86394a3, доказательства 4b5ce39. Перенос/cherry-pick не нужен.

| ID | В ветке | Файл | Подтверждение тестом |
|---|---|---|---|
| C01 | да | src/lib/attempt-draft.ts; src/components/test-runner.tsx | src/lib/attempt-draft.test.ts |
| C02 | да | src/server/actions.ts finishAttempt | tests/reliability-database.test.ts: rollback, race, idempotency |
| C03 | да | src/components/test-runner.tsx | attempt-draft tests; прежний Chrome, новый таймерный Chrome ещё не повторён |
| C04 | да | src/lib/task-origin.ts; src/server/sync.ts | reliability-database: custom/moved/DONE |
| C05 | да | src/app/editor/questions/[id]/page.tsx; question-editor.tsx | role tests; прежний Chrome |
| C06 | да | src/lib/question-input.ts; src/components/forms.tsx | reliability-database: 4 типа/ID/ответы |
| C07 | да | completeLesson; learn/[topicId] | reliability-database: acknowledgment/empty; IN_PROGRESS не MASTERED |
| C08 | да | changeElective; elective-form.tsx | reliability-database: rollback/concurrent/history |
| C09 | да | src/proxy.ts | src/proxy.test.ts |
| C10 | отложен | onboarding | логику не расширять в этом запуске |

## Повторные проверки текущего кода

- TypeScript --noEmit --incremental false: 0, PASS.
- npm run lint: 0, PASS.
- npm test -- --maxWorkers=2: **163 passed / 8 skipped / 0 failed**, 27 файлов passed + 2 skipped. Числа совпали с прошлым отчётом. 8 старых opt-in тестов не объявлены выполненными.
- npm run build: 0, PASS, отдельные зависимости и одноразовая БД, без .env.
- QA migrations: 5 существующих миграций применены только к новой audit/tests/beta-chrome.db.
- Проверено чтением конфигов и DB fixtures: тесты используют mocks/временные SQLite; tests/db.test.ts использует только worktree-local prisma/test.db. Default DATABASE_URL принудительно направлен на отдельную QA БД; legacy opt-in отключены NMT_AUDIT_DB=0. prisma/dev.db тестами не используется.
- Исходный Playwright-конфиг не запускался: он привязан к порту 3000 и seed учебных материалов. Для следующих этапов нужен отдельный QA-конфиг.

## Production Chrome

Сервер 127.0.0.1:3100, PID 23844, SESSION_COOKIE_SECURE=false только в процессе; синтетический STUDENT_A.
Вход по HTTP → главная → математика → тема → конспект → вкладка практики → запуск тематического теста: проверено в браузере. Стили присутствуют, условия остановки «без стилей» нет. Заметки/результаты из seed — явно синтетические, не содержимое рабочей БД.
Скриншоты: design/screenshots/00-baseline, не коммитить.
Наблюдения для последующих этапов: QA-тема с теорией показывает coverage «Немає матеріалів» (метаданные seed не отражают наличие контента); навигация новой практики показывает один ответ сразу (проверить представление пустого matching). Пока не объявлено исправленным.
Полный новый сквозной путь, mobile, обе темы и матрица ролей в этом baseline ещё не выполнены; это последующие acceptance-проверки.

## Снимок рабочей БД

Только VACUUM INTO через readOnly соединение. Анализ/Prisma status выполнялись **на копии**, не на оригинале. Копия содержит личные данные: не коммитить и не публиковать.
integrity_check=ok; foreign_key_check пуст; duplicate nickname groups=0; DROPPED custom-/moved-=0.
Копия содержит **4** применённые миграции: init → reconcile → normalize → add_query_indexes.
В репозитории дополнительно есть **20261018130000_nickname_case_insensitive**. migrate status на копии: exit 1, эта миграция ожидает применения. Рабочую базу не мигрировали; решение владельца потребуется отдельно перед rollout. Схему не меняли.
SQL восстановления C04 не нужен по найденным данным; предложение только SELECT в 00-c04-repair-proposal.sql, ничего не выполнялось.

## Основные функции: маршрут → код → действие → данные → роль → доказательство

| Функция/маршрут | Файл | Action/API | Таблицы | Роль | Доказательство/статус |
|---|---|---|---|---|---|
| Вход /login | src/server/actions.ts; session.ts | login/logout | User, Session | ANON/все | Chrome login; unit auth; повторный выход ещё не проверен |
| Главная / | src/app/(main)/page.tsx | syncPlan через layout | UserTopicProgress, StudyTask, TestAttempt | все свои | проверено в Chrome |
| Предмет /subjects/math | src/app/(main)/subjects/[slug]/page.tsx | серверное чтение | Subject, Topic, ExamResult | все свои результаты | проверено в Chrome |
| Тема /topics/[id] | src/app/(main)/topics/[id]/page.tsx | logStudyMinutes/saveNote | Topic, Note, StudySession | все свои | Chrome страница; ownership tests |
| Урок /learn/[topicId] | src/app/(main)/learn/[topicId]/page.tsx | completeLesson/saveVideoPosition | UserTopicProgress, UserVideoProgress, VideoLesson | ученик/свои | Chrome; theory tests; A15 открыт |
| Попытка /tests/[id] | src/components/test-runner.tsx | saveDraft/finishAttempt | TestAttempt, Answer, Mistake, XpEvent | владелец попытки | покрыто fault/race/ownership; Chrome запуск |
| Результаты /results | src/app/(main)/results/page.tsx | saveExamResult/deleteExamResult | ExamResult | свои | ownership tests; UI ещё не повторён |
| Ошибки /mistakes | src/app/(main)/mistakes/page.tsx | reviewMistake | Mistake | свои | код userId, isolation tests |
| Календарь /calendar | src/components/task-controls.tsx | createCustomTask/moveTask/setTaskStatus | StudyTask, StudySession | свои | reliability tests; A10/A07 открыты |
| Повторение /review | src/app/(main)/review/page.tsx | reviewFlashcard/completeReview | Flashcard, ReviewSchedule | свои | код userId; A07 открыт |
| Настройки /settings | src/app/(main)/settings/page.tsx | savePreferences/changeElective | UserSettings, UserSubject | свои | transaction tests; UI ещё не повторён |
| Редактор /editor/questions/[id] | src/components/question-editor.tsx | saveQuestion | Question, QuestionOption | EDITOR+ | roundtrip tests; прежний Chrome |
| Пользователи /admin/users | src/server/actions.ts | updateUserRole | User, AuditLog | ADMIN/OWNER по иерархии | role-database tests |
| Backup /api/export/backup | src/app/api/export/backup/route.ts | buildBackup | снимок всех таблиц | OWNER | route unit tests; snapshot consistency A11 открыт |
| Журнал /admin/audit | src/app/admin/audit/page.tsx | writeAudit | AuditLog | ADMIN+ | audit-log tests; фильтрация шума ещё не проверена |

Мануал не найден, владелец уведомлён; таблица составлена по текущему коду и мастер-промпту. Это не подтверждение соответствия неизвестному мануалу. Этап 1 должен проверить A15, A10, A07; A11/A12/A13 оставить в pre-release backlog.

Рабочая база не изменялась.
