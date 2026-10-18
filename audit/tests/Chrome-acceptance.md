# Chrome acceptance — reliability fixes

Дата: 18.10.2026. Source SHA: `86394a35e8db56bceeaedbab73bb2038c6c0c77c`.

**C01–C09: PASS у виконаному acceptance-обсязі. C10: DEFERRED за прямою вказівкою не змінювати onboarding.**

## Середовище

Google Chrome, QA `http://127.0.0.1:3001`; робочий localhost:3000 не використовувався для тестових змін. База `D:/Вайб-кодинг/nmt-reliability/audit/tests/chrome.db` створена з нуля, містить тільки синтетичні профілі й матеріали. Без .env та реальних ключів. Різний hostname із live відокремлює cookie.

Source snapshot: `D:/Вайб-кодинг/nmt-reliability-qa-20261018`. Усі 145 src-файлів збігаються з перевіреним worktree. Спочатку перевірено dev/Turbopack; потім на тій самій QA-базі виконано production build і `next start`. Для локального HTTP production smoke явно використано `SESSION_COOKIE_SECURE=false` тільки в QA-процесі; production HTTPS/cookie deployment цим не змінювався.

Розміри: 1440×900 і 390×844. Ідентичності: ANON, STUDENT_A, STUDENT_B, EDITOR, ADMIN, OWNER. Dark Reader у DOM не знайдений. Інші розширення Chrome не вимикалися.

## Фактичні перевірки

| Дефект | Результат |
|---|---|
| C01 — миттєвий reload | Ввести 3 → одразу reload на 1440: після відновлення поле містить 3. Змінити на 7 → одразу reload на 390: поле містить 7. Під час відновлення поля тимчасово вимкнені, щоб введення не перетерлося гідратацією. |
| C01 — відмова autosave | Окремий QA-тригер відхиляв UPDATE чернетки. Введене 42 лишилося в полі; показані «Помилка збереження» та «Повторити збереження», без хибного saved. Reload відновив 42 із локальної чернетки. Після прибирання тригера retry показав saved; наступний reload та production reload зберегли 42. Стан помилки зафіксовано на обох ширинах. |
| C02 — частковий запис | QA-тригер відхилив другу Answer при завершенні за таймером. Перевірка SQLite: IN_PROGRESS, finishedAt=null, **Answer=[]** — на відміну від попереднього аудиту, перша відповідь теж відкотилася. Повторне завершення створило рівно три відповіді. Race/idempotency та пізній збій після XP додатково перевірені integration-тестами. |
| C03 — помилка таймера | При 0:00 є видиме повідомлення й «Повторити завершення» на 1440/390. Reload при активному fault не загубив відповіді. Після зняття fault натискання retry дало 3/3; повторний reload зберігає результат. Видалення локального запису лише після success перевірене unit-тестом контролера. |
| C04 — календар | Створено власне заняття 20.10, reload не видаляє його. Перенесено на 21.10: після reload на 390 і 1440 воно PLANNED у видимому календарі. «Перерахувати план» зберігає перенесене заняття. У БД оригінал MOVED, наступник PLANNED, не DROPPED. DONE і зміна навчальних днів додатково перевірені integration-тестом. |
| C05 — редактор | EDITOR натиснув реальне посилання «Редагувати» у /editor/questions і отримав форму. Після save повернення до /editor/questions. ADMIN після свого save повертається до /admin/questions. STUDENT_A/B не можуть відкрити ці редактори, EDITOR не може відкрити /admin/users. |
| C06 — ключі відповідей | EDITOR змінив лише текст SINGLE_CHOICE, MATCHING, SEQUENCE, NUMERIC на кожній ширині; усі 8 збережень успішні. Порівняння до/після у SQLite: correctAnswer та всі option IDs незмінні для кожного типу. NUMERIC також перевірено через admin return. Грейдинг і блокування використаних питань — у real-DB integration-тестах. |
| C07 — теорія | Без перевірених питань оцінюваний тест лишається вимкненим, але є «Я опрацював конспект». Без прапорця — видима відмова; із прапорцем — «Урок зараховано», статус Вивчається й повторення. Обидві ширини. Порожній матеріал не зараховується в integration-тесті. |
| C08 — elective | Без підтвердження показано alert «Підтвердьте зміну предмета», вибір форми не скидається. Із підтвердженням — видимий success і Географія. У БД рівно один активний elective; історичний результат збережений. Серединний fault та дві конкурентні зміни — integration PASS із повним rollback / одним elective. |
| C09 — API | ANON /api/export/backup показує JSON «Потрібен вхід», не форму login, на 1440/390. Dev HTTP logs: 401. Окремий production HTTP smoke: **401 application/json**, артефакт production-api.json. Invalid-cookie branch перевірений proxy/endpoint unit-тестами, не ін'єкцією cookie у Chrome. |
| C10 | Не змінено й не позначено виправленим: onboarding заморожено користувачем. |

## Матриця доступу

Для STUDENT_A/B, EDITOR, ADMIN, OWNER на кожній ширині перевірено:

`/settings`, `/learn/qa-empty`, `/tests/qa-attempt-a`, `/editor/questions/qa-unused-NUMERIC`, `/admin/questions/qa-unused-NUMERIC`, `/admin/users`.

60/60: очікуваний екран або очікувана відмова. Чужа спроба A закрита навіть OWNER: адміністративний доступ до спільних матеріалів не надає доступу до персонального учнівського результату. ANON має ще 10 перевірок redirect до login. Це не перенесення PASS на всю попередню 504-рядкову матрицю.

B також перевірив /notes і /results?edit=qa-result-a: даних A та редактора чужого результату немає. Прямі негативні mutation з чужими ids підтверджені ізольованими integration-тестами.

## Production smoke

Production build PASS. У Chrome після запуску production:

- відповідь 42 відновлюється;
- завершений fault-test має 3/3 після reload;
- EDITOR бачить редактор на 1440/390;
- /admin/users для EDITOR закритий;
- ANON API повертає JSON; окреме HTTP-звернення підтвердило 401 та application/json.

Окремий повтор у чистій production-вкладці: login EDITOR → заборонений /admin/users → дозволений editor detail. Консоль error/warn: **[]** (`production-console.json`).

## Консоль та обмеження

Hydration-помилок у записаних dev-повідомленнях немає. У dev зафіксовано 16 повідомлень React/Next про script tag під час проходу заборонених маршрутів. Їх не приховано і не названо виправленими: першопричину окремо не змінювали; на зазначеному повторі в production вони не відтворилися. Ще одна помилка autoplay походить із chrome-extension://…/content-all.js, а не з коду платформи.

Справжній offline/reconnect через browser network emulation не виконувався: інструмент не надає цього режиму. Натомість виконано реальні відмови запису SQLite в Chrome та unit-тести відмов save. Повна перевірка сторонніх розширень, HTTPS LAN deployment, усіх маршрутів продукту, матеріалів, restore й видачі привілейованих ролей не входить до цього fix-проходу.

Докази: chrome-observations.json (113 спостережень), chrome-network.json (179 dev HTTP records без cookie/headers), chrome-console.json, production-console.json, chrome-summary.json, chrome-state-before-edit.json / after-edit.json, chrome-fault-before-retry.json / after-retry.json. Повні знімки збережені у worktree audit/tests/screens; ключові знімки включені до коміту.
