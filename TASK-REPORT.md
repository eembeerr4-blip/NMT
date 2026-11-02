# TASK-REPORT: Webpack + Tailwind UI fix

## Ціль

Відновити коректний layout (sidebar, responsive `md:*`/`lg:*`, мобільна навігація лише на малих екранах) після переходу `next dev` на Webpack, без повернення Turbopack.

## Точна причина

При `next dev --webpack` Tailwind CSS v4 **не проходив через PostCSS**: у репозиторії не було `postcss.config.*`, а інтеграція `@tailwindcss/turbopack` у `next.config.ts` працює лише з Turbopack. Браузер отримував **необроблений** `globals.css` (директиви `@import "tailwindcss"`, `@config`, `@source` без згенерованих utility-класів). Через це не застосовувались `hidden`, `md:hidden`, `md:pl-64` тощо — нижня мобільна панель була видима на десктопі, sidebar «зжимався».

## Що змінено

| Файл | Зміна |
|------|--------|
| `postcss.config.mjs` | **Новий:** `@tailwindcss/postcss` |
| `package.json` / `package-lock.json` | devDependency `@tailwindcss/postcss`; `dev` залишається `next dev --webpack` |
| `src/app/globals.css` | `@config`, `@source` обмежено `./src/**` (без сканування `prisma/` і WAL) |
| `tailwind.config.ts` | `content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"]` (узгоджено з `@source`) |
| `src/components/app-shell.tsx` | Logout у Radix: `onSelect` → `preventDefault()`, щоб форма «Вийти» відправлялась |
| `e2e/editor-flow.spec.ts`, `e2e/student-flow.spec.ts` | Селектор меню профілю: `button` замість `summary` |
| `e2e/registration-flow.spec.ts` | Очікування повідомлення після skip діагностики через `role="status"` |

Інші зміни на гілці (`admin-nav`, block-02) — поза ядром Tailwind-фіксу.

## Перевірка відображення

- **CSS на `localhost:3000`:** згенерований bundle великого розміру, без сирих `@config`; присутні правила на кшталт `md:pl-64`, `md:hidden` (перевірка HTTP).
- **Браузер MCP:** `/login` на `localhost:3000` — стилізована форма (світла/темна тема на сторінці входу). Вхід `e2e_student` на **dev.db** не вдався (користувача немає) — повний logged-in shell на :3000 не перевірявся вручну.
- **Playwright E2E (webpack, `127.0.0.1:3010`, e2e.db):** `nav-consistency` (390/320, світла/темна), `student-flow` (390px темна), `academy` (мобільна навігація без горизонтального скролу), решта сценаріїв — **31/31 PASS** (фактичний рендер UI в Chromium).

## Команди та результати

| Команда | Результат |
|---------|-----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (1 warning у `scripts/set-user-password-local.mjs`, не з цієї задачі) |
| `npm run build` | PASS |
| `npm run test:e2e` | **31 passed** |

## Git

- Гілка: `feature/block-02-fixes`
- PostCSS/Tailwind та e2e/logout — **локально змінені**, коміт не виконувався (за запитом власника).

## Ризики / дії власника

- Після зміни PostCSS перезапустити `npm run dev` і за потреби очистити `.next`, якщо CSS знову виглядає «сирим».
- Turbopack не повертати, поки не вирішено читання `prisma/dev.db-shm` у CSS pipeline.
- За бажанням — коміт фіксу Tailwind + e2e + logout окремим комітом.
