# Backlog — лише план, без виконаних виправлень

Працювати по одному блоку від перевіреного SHA. Спершу Chrome-підтвердження доступних сценаріїв; для atomicity потрібні також контрольовані ізольовані тести. Не запускати ці роботи в рамках source read-only аудиту.

| Блок | Scope | Acceptance | Перевірки на наступному write-етапі |
|---|---|---|---|
| B01 Редактор контенту | A01/A02: editor detail/back, стабільне кодування keys | EDITOR редагує невикористане питання без переходу в /admin; keys не змінені; STUDENT denied | Round-trip 4 типів, role checks, Chrome G12; typecheck/lint/targeted tests |
| B02 Надійність тесту | A03/A04/A05: атомарність, ідемпотентність, offline draft, timeout | Один фінальний результат/XP; rollback; відновлення після offline/reload; помилка таймера не стирає дані | Fault injection + concurrent requests на disposable DB, G5 у Chrome; production build окремо |
| B03 Календар і elective | A06/A07/A10: transaction boundary, valid dates, visible ActionState | Один elective після успіху, жодного часткового стану після помилки; календар не приховує відмову | Негативні server inputs, rollback, history preservation, G7/G8/G10 |
| B04 Межа shared відео | A15: відокремити особисту позицію від shared duration | Учень змінює лише своє положення; shared metadata захищені | STUDENT_A/B + EDITOR, null/non-null duration, backend direct action attempts |
| B05 Empty-state навчання | A09: узгодити «прочитано» без VERIFIED практики | Немає тупика, читання не видається за mastery; ясний next step | no-video/no-questions/section fixtures, G3/G4, keyboard/mobile |
| B06 Інтеграція персоналізації | A08: перенос контракту, цілі, baseline, resumable onboarding | Весь E2E flow; не втрачено roles/audit/content/security; baseline не потрапляє у звичайні середні | Підготовлений copy backup; узгоджена міграційна послідовність; fresh migrate deploy та copy DB diff/row counts тільки на цьому етапі |
| B07 Консистентність backup | A11: snapshot, validation/restore contract, sensitive file handling | Одночасні записи не ламають backup; restore атомарний; OWNER-only | Round-trip + FK/integrity/counts на disposable DB; журнал не дублюється; робочу БД не замінювати |
| B08 Інфраструктура перед публікацією | A12/A13/A14: auth/API contract, контроль реєстрації, профілювання; додатково рішення щодо AI feature-off/error text і schema owner/FK tech debt | API predictable 401; public rate limits; записані query count/p95; немає непогодженого schema rewrite | Спершу профіль і runtime конфігурація; ownership A/B; schema diff collation index на копії; потім обґрунтовані локальні зміни |

Блок B06 не є дозволом blindly merge feat/personalized-onboarding. Її migration 20261017220000 починається з ALTER TABLE User раніше основного reconcile, що створює User. Узгодити порядок і перевірити fresh deploy, зберегти всі п'ять поточних міграцій. Нічого з цього в аудиті не виконувалося.

Фінальна acceptance після погоджених змін: typecheck → lint → ізольовані tests → production build → Chrome regression за новим SHA. У read-only аудиті ці DB/build/Chrome кроки не запускати.
