# Этап 2 — права и разделение контекстов

Ветка beta/02-permissions. Основа: 9c945da. Рабочий каталог D:/Вайб-кодинг/nmt-beta.

## Карта и доказательства

Карта audit/reports/02-actions-map.md и JSON: 55 module-level Server Actions, 5 inline Server Actions, 4 HTTP handlers, 205 кандидатов вызовов Prisma. Построена по AST текущих файлов, без зависимостей и runtime-секретов. Автоматические guard labels отдельно отмечены как карта, а не доказательство.

Новая permissions-matrix.test.ts: **50 негативных прямых вызовов**. ANON/STUDENT отвергаются всеми 15 редакторскими, 4 административными и 2 OWNER действиями; EDITOR отвергается административными/OWNER, ADMIN — OWNER. Проверяется не только ok:false/throw UserError, но и отсутствие любого обращения к Prisma и secrets. Import/buildBackup, возвращающие исключение вместо ActionState, проверены с их настоящим контрактом. Во второй контракт их не переделывали.

Личные модели проверены через userId/parent chain: userVideoProgress compound key, попытка/Answer через владельца TestAttempt, заметки/результаты/занятия/повторения/карточки/ошибки через текущего пользователя. Общие Topic/Question/VideoLesson не требуют userId, но требуют editor. Внутренние planner id получены из выборки владельца. Кандидаты where:{id} без контекста не названы утечкой.

## Реальные изменения

- 497a8cb: C09, export/results при getSessionUser=null возвращал text/plain 401 (включая expired cookie, прошедшую cookie-presence proxy). Тест RED → JSON401 GREEN; приватный запрос не выполняется.
- 542cddb: чистое учебное меню для OWNER/ADMIN — административный пункт удалён из sidebar и mobile drawer. В профиле остаётся явный переход в отдельный /admin. SSR RED → GREEN; студент не получает новый доступ.
- 95e558e: 50 прямых негативных проверок; новых обнаруженных обходов editor/admin/owner guards нет.

## Матрица ролей

| Операция | STUDENT | EDITOR | ADMIN | OWNER | Доказательство |
|---|---|---|---|---|---|
| Личные учебные данные | свои | свои | свои | свои | isolation-hardening, reliability, real sessions |
| Общий контент | отказ | да | да | да | content/permissions matrix + real question roundtrip |
| /editor/questions/[id] | 404 | 200 | 200 | 200 | desktop/mobile Chrome |
| /admin | отказ | отказ | да | да | guards, role-database, Chrome |
| Назначить STUDENT/EDITOR | отказ | отказ | да | да | role-database и permissions unit |
| Назначить ADMIN/OWNER | отказ | отказ | отказ | да | role-database: escalation/confirmation/audit rollback |
| Backup/restore | отказ | отказ | отказ | да | 401/403/200 actual sessions + API tests |
| Журнал | отказ | отказ | да | да | inherited requireAdministrator, server queries |

Роли выбираются из иерархии OWNER→ADMIN→EDITOR→STUDENT; изменение по неизменяемому id, интерфейс ищет nickname. Первоначальный id=owner защищён, собственную роль менять нельзя; дополнительные OWNER требуют password+точный nickname; перед понижением OWNER проверяется число владельцев. Отдельного действия удаления пользователя нет — фиктивную проверку удаления не заявляем. Схему/миграции не меняли.

## Журнал

AUDIT_ACTIONS не содержит «ученик прошёл тест». Есть auth, роли, контент, настройки, интеграции, backup/export. Metadata сохраняется по whitelist: счётчики, роли, имена изменённых полей. Пароли/token/session/тексты заметок/backup не сериализуются. Audit-log tests проверяют отбрасывание секретов и транзакционный rollback. Обычные личные учебные действия не превращены в шум административного аудита.

## Gate

- Typecheck PASS; lint PASS после поправки синтаксиса SSR-теста.
- Полный suite **238 passed /8 skipped /0 failed**, 34 passed files +2 skipped; SSR test после lint-правки повторно PASS.
- Production build PASS. Первый запуск generate был заблокирован Windows EPERM: одновременно открытые тестами Prisma DLL; после окончания тестов повторная сборка успешна. В дальнейшем DB-tests и prisma generate выполнять последовательно.
- Runtime — отдельный QA-сервер 127.0.0.1:3100, PID 23176, с process-only HTTP-cookie настройкой. Рабочий 3000 не трогали.
- Chrome: **14 passed /0 failed**, desktop1440×900/mobile390×844, real Chrome production; expired-cookie 401 JSON для всех 4 API; OWNER menu→/admin; вся регрессия этапа1 сохранена. Доказательства audit/reports/02-playwright.json и design/screenshots/02-permissions.

Не изменяли неповторившиеся guards и матрицу назначения ролей. Bootstrap claimOwner — отдельный контракт localhost + первоначальный профиль без password; это не общий редакторский action. Публичный deploy и bootstrap hardening не объявлены проверенными. C10/персонализация не интегрировались; материалы не менялись.

Следующий шаг: завершить Chrome gate, затем этап3 — полная визуальная инвентаризация до изменений страниц.

Рабочая база не изменялась.
