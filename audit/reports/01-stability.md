# Этап 1 — стабильность

Ветка beta/01-stability, каталог D:/Вайб-кодинг/nmt-beta. Мануал найден по указанию владельца: D:/NMT_Academy_4.0_Manual_RU_2026-10-18.md, прочитан; порядок работ определяется мастер-промптом (персонализацию не интегрируем).

## Что изменено и чем доказано

| Пункт | Решение | Коммит / проверка |
|---|---|---|
| 1a C01–C09 | Уже присутствуют в основной ветке; повторный перенос не нужен | baseline 4b5ce39; новая регрессия |
| 1b A15 | Удалён ученический UPDATE VideoLesson.durationSec; только личный целочисленный прогресс, bounded known duration или 86400 | 358a7b0; тест RED (null → 100), GREEN; A/B isolation и отрицательные/неfinite позиции |
| 1c A03/C02 | Не переписывали: существующая tx/CAS/idempotency прошла fault/race/retry/ownership | tests/reliability-database.test.ts; late achievement fault тоже откатывает результат/XP |
| 1d A06 | Не переписывали: changeElective вместе с планом уже транзакционен; перенос пересчёта наружу ухудшил бы проверяемый rollback | midway fault и competing choices проходят |
| 1e A07 | useActionFeedback поверх существующего ActionState; календарь, создание/перенос/пропуск/пересчёт, повторение/карточки и elective: pending, lock, error, success; переход только после ok | 2c296f9; 3 unit RED → GREEN; Chrome SQLite fault → visible error → inputs retained → retry → persisted |
| 1f A10 | Строгая дата через round-trip; календарный URL использует безопасный fallback; create/move отвергают невозможные дни; kind по TASK_KINDS | d6fa262; 14 targeted assertions GREEN после RED |
| 1g C04 | Дополнительно найдено: shiftOverdue менял прошлые личные custom/moved. Теперь только auto, ключи генератора/классификатора в одном task-origin | 3b64ed2; два sync не меняют ни дату, ни updatedAt; старые future custom/moved/DONE tests проходят |
| 1h C07 | Backend не давал MASTERED за чтение, это подтверждено; UI теперь точно говорит «Позначити конспект як опрацьований» и объясняет будущую оценку практикой | 21dee47; SSR RED → GREEN, DB IN_PROGRESS, Chrome acknowledgement/отказ |
| 1h C05/C06/C09 | Не переписывали: работают | 4 типа ID/correctAnswer DB round-trip; proxy unit; EDITOR/ADMIN/OWNER real editor 200, STUDENT 404; ANON JSON401 |

Дополнительная автоматическая регрессия 30d1188: реальная SQLite + реальные Session/cookie helpers, неправильный пароль, case-insensitive login, logout/re-login, duplicate nickname P2002, backup ANON401/STUDENT403/OWNER200. Никаких реальных паролей/пользователей.

## Финальные gates

- npx tsc --noEmit --incremental false: PASS.
- npm run lint: PASS.
- npm test -- --maxWorkers=2: **185 passed / 8 skipped / 0 failed**, 31 passed files +2 skipped.
- npm run build: PASS (последний app source соответствует 30d1188; последующий test-only commit не меняет runtime).
- Production npm start: QA 127.0.0.1:3100, PID 20796, отдельная beta-chrome.db, SESSION_COOKIE_SECURE=false только в процессе. Стили на месте.
- Playwright установленный Chrome: **10 passed / 0 failed**, desktop1440×900 и mobile390×844. Без legacy config/порта3000/seed материалов. Новый конфиг playwright.beta.config.ts.
- Ручной текущий Chrome: главная → предмет → тема → конспект → практика; новая страница повторения с labels и кнопками. Полная визуальная инвентаризация впереди.

Прогон сначала обнаружил дефекты самих новых тестов: неоднозначный role=alert из-за Next route announcer; скрытая вкладка «Навчання»; предположение HTTP404 вместо streamed not-found; два noindex вместо одного. Исправлены selectors/ожидания по фактическому DOM и установленной Next документации, приложение ради зелёного теста не менялось. Финальный полный прогон — 10/10.

Отдельная семантика Next: B получает на чужой /tests/qa-attempt-a streamed оболочку с HTTP200, затем «Сторінку не знайдено», noindex и без формы/ответов A. Это документированное поведение notFound после streaming (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md:193). Для STUDENT → editor route HTTP404 получен до streaming. Не объявляем все отказы HTTP404 и не считаем один статус доказательством изоляции.

## Регрессионный набор 1–9

1. Auth/session/invalid password/NOCASE unique: real DB integration + Chrome login/reload.
2. Draft immediate local recovery/fault/race/atomic finish/no duplicate XP: unit + real DB; предыдущие C01–C03 Chrome доказательства сохранены, полный новый browser path будет на этапе6.
3. Calendar create/reload: Chrome; custom/moved/DONE/recalc/sync twice: real DB (включая новый overdue case).
4. Theory acknowledgment: real DB + SSR + desktop/mobile Chrome, IN_PROGRESS≠MASTERED.
5. Editor guards: real Chrome роли; IDs и correctAnswer всех4 типов: real DB.
6. ANON API JSON401: proxy unit + Chrome request; backup реальные session integration 401/403/200.
7. Personal A/B: isolation-hardening и reliability suites; браузер B → private attempt denial.
8. Shared content: existing content/role/question negative tests + новый A15, STUDENT не меняет duration.
9. Elective: transaction rollback/race/history tests; visible confirmation error and retained selection in Chrome.

## Только в pre-release backlog, НЕ исправлялись

- A11 buildBackup читает таблицы несколькими Promise.all без единого snapshot; при конкурентной записи JSON может быть несогласован. OWNER-only и restore round-trip не доказывают snapshot consistency. Backup содержит passwordHash: хранить приватно. Stage6 проверит VACUUM INTO/restore только на QA; сам A11 по заданию не менять.
- A12 login throttle — Map в памяти по nickname, 5 ошибок /15 минут; нет IP/distributed protection, возможен targeted lockout. Не менять в этом запуске.
- A13 syncPlan вызывается из (main)/layout; работа с календарём в циклах/повторные запросы. React cache уменьшает повтор в одном render, но не устраняет работу на каждом запросе и N+1. Место вызова не меняли.
- Рабочая БД: 4/5 миграций; nickname_case_insensitive не применена. Перед rollout нужно отдельное решение владельца, этот запуск её не применяет.

Отчёты/логи: audit/reports/01-*. Скриншоты: design/screenshots/01-stability/ (не коммитятся). Audit и design/screenshots не добавлялись в Git. Merge/push не выполнялись; основной каталог и onboarding worktree не изменялись по коду.

Следующий шаг: этап 2, карта всех actions/API и негативная матрица ролей, только доказанные исправления.

Рабочая база не изменялась.
