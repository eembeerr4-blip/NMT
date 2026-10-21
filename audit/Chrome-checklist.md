# Chrome acceptance — наступний окремий прохід

Статус усіх кейсів: NOT RUN. У поточному аудиті браузер не запускався, профілі не створювалися й дані не змінювалися.

## Передумови

- Звірити тестований SHA з a37d8cb; якщо код змінено — оновити очікування, не переносити PASS автоматично.
- Окреме disposable QA-середовище, ізольована база й шість підготовлених ідентичностей: ANON, STUDENT_A, STUDENT_B, EDITOR, ADMIN, OWNER. Це шість ідентичностей, не п'ять. Їх підготовка — окремий дозволений write-етап, не частина code audit.
- QA-хост відрізняється від live localhost; cookie не розділяються портом. Не перетирати робочу сесію входом на localhost:3001.
- Style extensions, включно з Dark Reader, вимкнені для базового проходу. Основні viewport 1440×900 та 390×844, додатково навігація 768px/1920px. Light/dark перевірити окремо.
- Дані: порожній новий учень, учень із історією, незавершений тест, завершений тест, теорія без відео, урок без VERIFIED питань, shared video з durationSec=null, невикористане питання кожного типу, використане питання, прострочені/перенесені/виконані заняття.
- Відновлення backup і зміна привілейованих ролей — лише на заздалегідь погоджених disposable fixtures із потрібним підтвердженням. Не відновлювати живу базу «для перевірки».

## Матриця маршрутів

Chrome-route-role-matrix.csv містить 504 комбінації role × route × initial state × viewport. Це стартова матриця, не 504 виконані перевірки. Не трактувати code expectation як ціль після виправлення: підтвердити поточні дефекти, а після правки перевірити acceptance зі звіту.

Для кожного доступного екрана додати empty/populated/loading/server-error, query filters, refresh, back/forward і keyboard focus. Для forbidden — прямий URL та спроба виклику серверної операції з fixture другого користувача. Записувати факт: PASS/FAIL/BLOCKED/NOT APPLICABLE, URL, screenshot, console, network status, фактичні збережені дані. Не включати cookie, auth headers, паролі або ключі до звіту.

## Пріоритетні сценарії

| Case | Роль × маршрут × стан × viewport | Кроки й очікування |
|---|---|---|
| G1-C01 | ANON → /login,/onboarding; fresh; 1440/390 | Невірний/вірний пароль, reload, remember-me, logout; немає незрозумілого повернення на /. Окремо HTTP LAN/production Secure cookie. |
| G2-C01 | STUDENT_A → / та навігація; populated/empty; 1440/390 | Усі видимі пункти, mobile menu, пошук, refresh/back/forward; зберігається сесія й контекст. |
| G3-C01 | STUDENT_A → /subjects/[slug],/topics/[id]; active/unknown; 1440/390 | Чотири активні предмети, підтемний розділ, неіснуючий id, наступна тема. |
| G4-C01 | STUDENT_A → /learn/[topicId]; no video/no verified; 1440/390 | Empty states без випадкових матеріалів; корисний наступний крок; перевірити A09. |
| G4-C02 | STUDENT_A/STUDENT_B/EDITOR → відео з null duration; 1440 | Відтворити A15 на fixture; учнівська особиста позиція не повинна дозволяти зміну shared duration. Не виконувати на live. |
| G5-C01 | STUDENT_A → /tests/[id]; in progress/offline; 1440/390 | Відповісти, миттєвий reload до 450 мс, offline autosave, reconnect; перевірити відновлення й індикатор збереження (A04). |
| G5-C02 | STUDENT_A → timed test; timeout + save failure; 1440/390 | При {ok:false} не зникає чернетка, є retry; unhandled rejection відсутній (A05). |
| G5-C03 | STUDENT_A → один test у двох вкладках; concurrent/fault; 1440 | Після окремої fault-injection підготовки — атомарність відповідей, один результат/XP, rollback при збої (A03). Сам Chrome без контрольованого збою не доводить атомарність. |
| G6-C01 | STUDENT_A → /results,/analytics; full/partial/empty; 1440/390 | Додати/редагувати/cancel/видалити синтетичний результат, фільтри, періоди; не змішуються raw/rating і partial; історія зберігається. |
| G7-C01 | STUDENT_A → /mistakes,/review; due/overdue/failed write; 1440/390 | Категорія, статус, повторити/знаю, створити картку; відмова видима; після reload стан той самий (A07). |
| G8-C01 | STUDENT_A → /calendar; planned/in progress/done/moved; 1440/390 | Розпочати/завершити/перенести/перерахувати, denied write й невалідна дата; помилку не маскує навігація. |
| G8-C02 | STUDENT_A → /settings; elective change/fault; 1440/390 | Відмова без confirm, успішна зміна, контрольований збій посередині; рівно один elective; DONE/історія збережені (A06). |
| G9-C01 | STUDENT_A/B → /notes,/search; empty/long/query; 1440/390 | Власні нотатки, редагування, cancel/delete, пошук. Підміна id іншого учня не дає читання/зміни. |
| G10-C01 | STUDENT_A → /settings; all tabs; 1440/390 | Profile view, elective, навчальні налаштування, тема; немає backup/restore/roles/JSON-конфігів та видимих технічних порогів. Власний CSV результатів в іншому розділі не плутати з full backup. |
| G11-C01 | STUDENT/EDITOR/ADMIN/OWNER → /admin/users,/editor; direct URL; 1440/390 | Учень не отримує editor/admin. ADMIN не видає OWNER/ADMIN; OWNER-sensitive дії мають password+nickname confirmation; початковий owner захищений. |
| G12-C01 | EDITOR → /editor/questions → edit; unused; 1440/390 | Поточний A01: детальний editor URL відсутній. Після виправлення edit та back лишаються в /editor. |
| G12-C02 | ADMIN/EDITOR → question editor; SC/MATCHING/SEQUENCE/NUMERIC; 1440 | Змінити тільки текст, не чіпати ключ. Перевірити A02; numeric control проходить; історію використаного питання не переписувати. |
| G12-C03 | EDITOR/ADMIN → topics/lessons/questions; empty/filter/page; 1440/390 | GET-фільтри працюють, query зберігається, списки/редактори/пагінація/архівування дають результат і повідомлення. |
| G13-C01 | OWNER/ADMIN/EDITOR/STUDENT → backup/API; denied/populated; viewport n/a | Full backup тільки OWNER; results CSV тільки own user; банк питань тільки editor+. Сховати токени в доказах. GET backup створює подію, тому тільки QA. |
| G13-C02 | OWNER → restore; malformed/valid disposable file; 1440/390 | Preview/confirmation, rollback на невалідному файлі, перевірка консистентності, вихід/повторний вхід. Живу БД не замінювати. |
| G13-C03 | ADMIN/OWNER → /admin/audit; empty/filter/invalid dates; 1440/390 | Реальні події fixtures, actor/action/date filters, paging, ніяких секретів. |
| G14-C01 | ANON/invalid cookie → /api/ai/stream,/api/export/*; viewport n/a | Записати поведінку proxy (A14). Без cookie поточний код redirect до login; з присутньою невалідною cookie endpoint дає 401. Бажаний API-контракт — однаковий 401 JSON. |
| G14-C02 | Кожна дозволена роль; slow/error; 1440/390 | Focus, keyboard, modal escape/cancel, contrast, horizontal scroll, loading/error/not-found; спочатку без extensions. |

## A/B ownership — окрема обов'язкова таблиця

STUDENT_A створює note/result/task/card/attempt/video notes. STUDENT_B перевіряє свої списки й відомі A ids: читання, update, delete, saveDraft, finishAttempt, moveTask, setTaskStatus, reviewFlashcard, setMistakeMeta. Очікування: B не отримує і не змінює A; повертання помилки не змінює жодного лічильника A. Окремо підтвердити allowed спільний контент і ADMIN-wide списки, щоб не назвати їх витоком між учнями.

## END-TO-END STUDENT PATH

Реєстрація → onboarding → вибір elective → baseline або пропуск → цілі по предметах → головна → предмет → тема → урок → практика → тест → результат → помилка → повторення → календар → прогрес → вихід → повторний вхід → продовження.

**Поточний a37d8cb:** baseline/goals за окремими маршрутами ще не інтегровані. Тут записати BLOCKED_BY_A08, а не вигадувати PASS. Решту доступного шляху перевірити незалежно. Після інтеграції повторити весь шлях із нового SHA та довести збереження стану на кожній межі.

На поточній основній гілці не доводиться resumable wizard: перервати onboarding на кроці, reload і порівняти; код зберігає wizard state у React, а нові onboardingStep/planVersion є лише в окремій гілці.
