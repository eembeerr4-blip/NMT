# NMT Academy beta: состояние выполнения

Актуальный HEAD: 9ef3c662f6e90cf2c9720977ad4dc0d67696d4d6.
Текущая задача: ГОТОВО для локальной визуальной беты:249 passed/8skipped,48Chrome+2fresh PASS,432финальных снимка,0pageerrors,0tableOverflow,12visual baselines,tsc/lint/build PASS. Следующий шаг — решение владельца о бете/слиянии и отдельной рабочей миграции; интеграцию onboarding не выполняли.
















Исходный HEAD: 4b5ce391375728503c75405a739b154d849e94f7.
Основная ветка: cursor/nmt-academy-lessons-and-audit; отслеживаемое дерево чистое.
Исполнение: D:/Вайб-кодинг/nmt-beta, ветка beta/06-visual-beta.
Рабочая база и порт 3000 не используются тестами. audit/ не коммитится.

- [x] 0. Контрольная точка — отчёт audit/reports/00-baseline.md; C01–C09 подтверждены; 163 passed / 8 skipped / 0 failed; typecheck/lint/build PASS; production Chrome со стилями.
- [x] 1. Стабильность — beta/01-stability; 185 passed / 8 skipped; typecheck/lint/build PASS; Chrome desktop/mobile 10/10.
- [x] 2. Права — beta/02-permissions; 238 passed /8 skipped; typecheck/lint/build PASS; Chrome 14/14.
- [x] 3. Дизайн-система — 416 исходных снимков; Inter/базовые компоненты; 238 passed /8 skipped, typecheck/lint/build PASS, Chrome14/14.
- [x] 4. Интерфейс ученика — группы A–H завершены; подробности04-student-ui.md.
- [x] 5. Админка и редактор — preview/публикация/архив/версии и responsive,249 тестов и38 Chrome этапа5.
- [x] 6. Подготовка беты —249 passed/8skipped,48Chrome+2fresh PASS,432финальных снимка,12visual baselines,tsc/lint/build PASS,snapshot/restore ok.
- [x] 7. План персонализации —07-onboarding-integration-plan.md; без интеграции, сравнение схем/истории завершено.

Новый прогон: 163 passed / 8 skipped / 0 failed. Копия БД: integrity ok, FK 0, дубли ников 0, ущерб C04 0. Из 5 миграций в рабочей базе применены 4; nickname_case_insensitive ожидает отдельного решения владельца.
Мануал прочитан: D:/NMT_Academy_4.0_Manual_RU_2026-10-18.md; коллаж доступен из предыдущего вложения.
Существующий playwright.config.ts запускает сервер на 3000: его не выполнять; нужен изолированный QA-конфиг с портом >=3100.
Следующий шаг: воспроизвести A15/A10 тестами и исправить минимально; A11/A12/A13 только в отчёт.

Коммит A15: 358a7b0e5ea42b7bae921076a1442f7dee4a59f8; тест сначала RED (duration стал 100), затем GREEN (личные позиции и изоляция); полный этап ещё не завершён.
Следующий шаг: A10, строгие календарные даты и тип занятия.

Коммит A10: d6fa262082e8a486e38d8e2e5a3dfce53f609af2; 14 целевых тестов GREEN после RED (11 ошибок). Строгий round-trip дат; guards create/move; enum kind. Следующий шаг: A07, видимая обработка ActionState в календаре и повторении.

Коммит A07: 2c296f980bff9e641524ff59af693e428e5f701e; 3 теста отказ/transport/concurrent-click сначала RED, затем GREEN. Общий useActionFeedback без смены ActionState; календарь, карточки/повторение, elective. Typecheck/lint PASS до коммита, регрессия этапа ещё впереди.
Следующий шаг: проверить синхронизацию просроченных личных занятий, затем полный gate этапа 1.

Коммит C04 follow-up: 3b64ed27f6febeaa1f7580c3516bef60acfb0bd4; RED → GREEN: sync дважды сохраняет просроченные custom/moved без изменения дат/updatedAt. Генерация/распознавание auto ключа в task-origin.ts.
Мануал найден и прочитан: D:/NMT_Academy_4.0_Manual_RU_2026-10-18.md (501 строка). Источник цели, не доказательство реализации. Приоритет этапов из мастер-промпта (персонализация не интегрируется).
Следующий шаг: полный gate этапа 1 и production Chrome на QA 3100; затем этап 2.

Коммит C07: 21dee47e8a9daf24ceea85ae0529d40c04e1e7a2; SSR-тест подписи RED → GREEN; теория сохраняет IN_PROGRESS, а не MASTERED. До этой подписи полный gate дал 182 passed / 8 skipped; build PASS, нужно повторить после последнего изменения.
Следующий шаг: расширить автоматическую auth-регрессию и закрыть gate этапа 1.

Тестовый коммит: 30d118838c488ed4a61c6c8fb63e25485c4f3eab; 2 integration tests GREEN: реальные сессии/пароль/logout/re-login, NOCASE unique, backup 401/403/200. Только временная база. Следующий шаг: финальный gate этапа 1 + Chrome.

Финальный коммит этапа 1: 9c945da7d5d8ac4ac844dbf7230f9b9eb2d9fe81 (QA config/tests). Рабочий runtime source 30d1188. Новый Chrome прогон 10 passed. Следующий шаг: этап 2 — роли/actions/API negative tests. Merge/push запрещены и не выполнялись.

Коммит C09 API expired-session: 497a8cbdb44f1cd1b877df20231b8671f61c34d9; RED text/plain → GREEN JSON401. 50 direct admin/content/owner negative calls PASS без обращения к БД/секретам. Следующий шаг: карта действий, student/admin separation, gate этапа 2.

Коммит separation: 542cddbaf9ca697e8d0aeeb29264c10d2c315863; SSR RED → GREEN. В sidebar/mobile ученического контекста нет /admin; профиль сохраняет явный переключатель в управление. Следующий шаг: полный gate этапа 2 и карта всех actions/API.

Коммит negative matrix: 95e558e8349408568466c28fb02d954f723f6bfa; 50 PASS до доступа к storage/secrets. AST карта 64 entries =55 module actions+5 inline+4 HTTP; 205 query candidates, audit/reports/02-actions-map.md/json. Следующий шаг: full gate этапа 2 и API expired-cookie Chrome.

Этап 2 завершён, коммит ea6fb12f5bc7249376b1f0bdd9c3bf3bba7cc89b. Следующий шаг: этап3, визуальная инвентаризация 390/768/1280/1920, обе темы; код страниц до инвентаризации не менять. Рабочий сервер QA PID23176.

Этап3: f6ad315da4df889b7911ac898209b4e87a5f7213. 36 кандидатов overflow — clipped decor/scroll tables, не названы автоматически 36 багами. QA B settings restored, integrity ok, FK/triggers empty. Следующий шаг: этап4A, оболочка и единые состояния; затем группы B–H.

2026-10-19T09:06:59.170Z — beta/04a-shell, bdb89e5dcadad69b39e4eca34adec1df06b89385: 4A: error/loading RED -> GREEN, коммит bdb89e5. Выполняется полный gate. Следующий шаг после PASS: 4B, честный следующий урок.

2026-10-19T09:09:01.493Z — beta/04a-shell, bdb89e5dcadad69b39e4eca34adec1df06b89385: 4A завершён: 240 passed /8 skipped, typecheck/lint/build PASS, Chrome14/14. Следующий шаг: 4B, главная не должна вести в пустую тему.

2026-10-19T09:10:46.354Z — beta/04b-dashboard, 2d116f6e65c005e2f3eb069b375c744fcfd73d36: 4B: воспроизведён активный CTA пустой темы; рекомендации отфильтрованы по реальному материалу, общий lessonAccess; unit3 PASS. Следующий шаг: gate4B -> группа4C.

2026-10-19T09:12:54.885Z — beta/04b-dashboard, 2d116f6e65c005e2f3eb069b375c744fcfd73d36: 4B завершён: 243 passed /8 skipped, gate PASS, Chrome16/16. Следующий шаг: группа4C, предметы/темы/урок.

2026-10-19T09:17:46.948Z — beta/04c-learning, e3b8d5353237ec5f2d54b7922ae73a80a1020b73: 4C: пустая тема больше не имеет активного старта; 4 предмета отдельно, поиск/фильтр/12 тем на страницу, доступные вкладки урока. TSC/lint PASS. Следующий шаг: gate4C -> 4D.

2026-10-19T09:25:26.411Z — beta/04d-tests, 1bebceea5c52b31903f542dbfe77e8d6061ea260: 4D завершена: 246 тестов и 22 Chrome, TSC/lint/build PASS. Следующий шаг 4E: видимый результат сохранения ошибки.

2026-10-19T09:28:18.395Z — beta/04e-progress, 125789f4dbf781d65fb449aa313a7d35f2a22649: 4E завершена:246 тестов/8 skipped,24 Chrome; все проверки PASS. Следующий шаг 4F: поиск и страницы личных журналов.

2026-10-19T09:33:09.784Z — beta/04f-personal-lists, 460bf4dfc2f630f6b0ea67bf2cb7832d48176610: 4F завершена:246 тестов/8 skipped,28 Chrome; все проверки PASS. Следующий шаг 4G: учебные дни и дневной лимит.

2026-10-19T09:36:25.154Z — beta/04g-settings, 88196514db6f2bb633a6adf0eabb1917a1f279ed: 4G завершена:247 тестов/8 skipped,30 Chrome; TSC/lint/build PASS. Следующий шаг 4H: постоянные подписи полей входа и регистрации, без расширения onboarding.

2026-10-19T09:39:12.214Z — beta/04h-auth-ui, 99beb2787b6d006ab642016d89a4eb28e903e95c: Этап4 завершён A–H:247 тестов/8 skipped,32 Chrome; TSC/lint/build PASS. Следующий шаг5: админские наборы тестов и мобильные таблицы.

2026-10-19T09:45:27.126Z — beta/05-admin-editor, 14171097d00e50db3671eec68965419ab53675ca: Этап5:248 тестов/8 skipped,38 Chrome PASS; предпросмотр, публикация, архив, версии и мобильные таблицы. Следующий шаг: контроль сохранения типа существующего набора, затем этап6.

2026-10-19T09:48:04.831Z — beta/05-admin-editor, c11f17afc9a618d06b5487c3fe7414af7ec8953c: Этап5 завершён:249 тестов/8 skipped,38 Chrome PASS; TSC/lint/build PASS. Следующий шаг6: доступность, отказ внешнего видео, сквозной путь новой QA-регистрации.

2026-10-19T09:58:39.268Z — beta/06-visual-beta, 6e4453c8d3f9c6c9ea5c5e1421d60cff67690c8f: Этап6:249 тестов/8 skipped,42 Chrome плюс2 visual и2 fresh PASS; snapshot/restore QA integrity ok. Следующий шаг: финальный gate44 и повторная визуальная инвентаризация, план персонализации.

2026-10-19T10:07:04.141Z — beta/06-visual-beta, d1b0a8ec6d80dca1bbc920cc376c7d66960f06ab: Этап6:249 тестов/8 skipped,46 Chrome PASS; TSC/lint/build PASS, snapshot/restore QA ok. Следующий шаг: финальные снимки432 экранов и подтверждение fresh-пути на текущей сборке; этап7-план подготовлен.

2026-10-19T10:15:08.442Z — beta/06-visual-beta, 9ef3c662f6e90cf2c9720977ad4dc0d67696d4d6: Финальный код:249 тестов/8 skipped,48 Chrome PASS; TSC/lint/build PASS;2fresh и12visual baselines подтверждены. Следующий шаг: инвентаризация432экранов текущего SHA, затем итоговый отчёт.

2026-10-19T10:21:00.378Z — beta/06-visual-beta, 9ef3c662f6e90cf2c9720977ad4dc0d67696d4d6: ГОТОВО для локальной визуальной беты:249 passed/8skipped,48Chrome+2fresh PASS,432финальных снимка,0pageerrors,0tableOverflow,12visual baselines,tsc/lint/build PASS. Следующий шаг — решение владельца о бете/слиянии и отдельной рабочей миграции; интеграцию onboarding не выполняли.
