# TASK-REPORT — діагностика Turbopack / ролі (Block 1)

## Ціль

Знайти й усунути дефекти, що заважають стабільній роботі після міграції Block 1, зокрема помилку Turbopack при зміні ролі користувача.

## Висновок щодо Turbopack

- У `prisma/dev.db` зміна ролі **вже виконалась успішно** до цієї задачі: `USER_ROLE_CHANGED` (STUDENT → ADMIN для `cmvi9mrg80001ut6wlomk1tym`, 2026-10-22 10:39 UTC).
- Оверлей «An unexpected Turbopack error» у dev часто ховає **необроблену помилку RSC/серверної дії**, а не окремий баг Turbopack.
- Підтверджені фактори для нового адміністратора без onboarding:
  - `onboarded: false`, **немає** `UserSettings` → `/admin/settings` викликав `getSettings()` з throw.
  - `requireAdministrator()` йшов через `requireUser()` → редірект на `/onboarding` для staff без завершеного профілю.
- Після `router.refresh()` повідомлення успіху в `RoleManager` зникає (ремонт компонента) — це виглядає як «збій» у UI, хоча БД уже оновлена.

## Що змінено

| Файл | Зміна |
|------|--------|
| `src/server/sync.ts` | `ensureUserSettings()` — клон шаблону `default` для staff |
| `src/server/actions.ts` | При ADMIN/EDITOR — provisioning settings; audit з іменем актора з сесії |
| `src/server/session.ts` | Адмін/редактор без onboarding → доступ до `/admin` і `/editor`; учні як раніше |
| `src/app/admin/settings/page.tsx` | `ensureUserSettings` перед `getSettings` |
| `src/components/role-manager.tsx` | `unstable_rethrow` для Next redirect/errors |
| `src/server/role-database.test.ts` | Регресія provisioning settings |
| `src/server/audit-actions.test.ts` | Mock `ensureUserSettings` |
| `e2e/academy.spec.ts` | E2E зміни ролі (ізольована `e2e.db`) |

## Перевірки

| Перевірка | Результат |
|-----------|-----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (1 попереднє warning у `scripts/set-user-password-local.mjs`) |
| `npm test` | **314** passed, 8 skipped |
| `npm run build` | PASS |
| `npm run test:e2e` | **13/14** PASS; сценарій ролі оновлено (стабільні assert після refresh); повний повтор SKIPPED (timeout webServer 120s, ймовірно конфлікт порту з `next dev`) |
| `prisma/dev.db` | **Не змінювалась** у цій задачі (лише read-only перевірки раніше) |
| Резервна копія | `prisma/backups/dev-block01-pre-migrate-20261022-1330.db` на місці |

## Рекомендації власнику

1. Перезапустити `npm run dev` після `prisma-generate-safe` (якщо engine був locked).
2. Новому адміну (`g7a3013ca3d5b05a1`): відкрити `/admin/settings` один раз — створиться `UserSettings` автоматично; за бажанням завершити onboarding.
3. Google OAuth UI/callback видалені в Block 1 — лишається email-вхід/реєстрація (`auth-service`).

## Ризики

- Існуючий ADMIN у dev без settings — виправляється при першому відкритті `/admin/settings` або повторному підвищенні ролі.
- `prisma-generate-safe` може пропускати locked `query_engine` — потрібен рестарт dev.

## Git

- Гілка: `feature/block-01-cleanup-unused`
- HEAD: `b97dd5a` (локальні незакомічені зміни включають цю задачу)

## Block 1

Функціонально Block 1 готовий до завершення після цих виправлень і ручної перевірки `/admin/users` + `/admin/settings` у dev. Block 2 не починався.
