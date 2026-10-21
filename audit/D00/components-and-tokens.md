# Компоненты, токены и единая дизайн-система

## 1. Фактическая архитектура

- App Router: `src/app/layout.tsx` → `ThemeProvider`; учебная ветка `src/app/(main)/layout.tsx` → серверная сессия/синхронизация → клиентский `AppShell` → server pages. `(main)` не входит в URL.
- `AppShell` в `src/components/app-shell.tsx` объединяет sidebar, header, drawer, профиль и mobile bottom navigation. Отдельных экспортируемых `Sidebar`/`Header` пока нет; не создавать их дубликаты. Внутренний `NavigationLink` уже есть.
- Административный layout — `src/app/admin/layout.tsx` + `AdminNav`. Редакторский — `src/app/editor/layout.tsx`; часть страниц re-export из admin с отдельной серверной проверкой. Визуальный компонент не должен подменять эту цепочку.
- CSS — `src/app/globals.css`, Tailwind CSS v4, `@theme inline`, class-based dark. Отдельного Tailwind config с кастомными breakpoint в исследованных файлах нет; установленные значения из `node_modules/tailwindcss/theme.css`: sm 640, md 768, lg 1024, xl 1280, 2xl 1536px; spacing 4px.
- Иконки: `lucide-react`. Tabs/Dialog — существующие Radix-пакеты; графики — Recharts; формулы — KaTeX/`MathText`.
- O использует Manrope, B Inter, оба через `next/font/google` с latin/cyrillic. Точный шрифт по коллажу доказать нельзя; Inter беты — разумная стартовая реализация с дальнейшим визуальным сравнением, не заявление о распознанном оригинале.
- Тема: `next-themes`, `attribute="class"`, `defaultTheme="system"`, переключение light/dark/system. Не фиксировать тему по номеру экрана коллажа. HTML `lang="uk"` и meta `darkreader-lock` уже есть.
- Shell: sidebar `w-64`/256px показывается от md; header 64px; main до 1440px; padding 16/24/32px; нижние пять ссылок и Radix drawer до md. В B responsive-таблицы переходят в карточки до 1023px, учитывая административный sidebar.

## 2. Инвентаризация повторного использования

Статусы: **оставить** — поведение/контракт сохранить; **оформить** — менять визуальные варианты; **B-only** — имеется только в бете. Это не разрешение на автоматический перенос.

| Компонент / файл | Где нужен | Решение |
|---|---|---|
| `AppShell`, `NavigationLink` — `src/components/app-shell.tsx` | Экраны 1–14, 16 | Оформить, не копировать. Сохранить active path, skip-link, drawer, профиль и условные admin/editor links. |
| `AdminNav` — `src/components/admin-nav.tsx`; admin/editor layouts | 15 и управление | Оформить позже; существующие guards и маршруты оставить. |
| `HeaderSearch` — `src/components/header-search.tsx` | Header | Оставить GET `/search?q=...`, label и maxLength. В коллаже есть подсказка клавиш; сейчас shortcut не реализован — не рисовать работающий ⌘K без обработчика. |
| `ThemeProvider`, `ThemeToggle` — одноимённые файлы | Обе темы | Оставить; тему не дублировать в собственном state. |
| `Button`, `Card`, `Input`, `Textarea`, `Label`, `Badge`, `PageHeader`, `Progress`, `Skeleton`, `EmptyState` — `src/components/ui.tsx` | Все экраны | Оформить через variants/токены. `asChild` сохраняет Link и form-семантику, disabled/pending не снимать. |
| `ErrorState`, `LoadingState`, `Stat`, `FormField`, alias `ProgressBar` — B `ui.tsx` | Ошибка/загрузка/метрики | B-only, переиспользовать. Проверить конфликты имени: в некоторых страницах уже есть локальный `Stat`. |
| `ContentTabs` — B `src/components/content-tabs.tsx` | 2, 4, 7, 9–14 | B-only. Radix tabs для локального content state; переходы по URL оставить Link, а не смешивать с вкладками без навигации. |
| `PanelDialog` — B `src/components/panel-dialog.tsx` | Формы, подтверждения | B-only. Сохранить focus trap, возврат фокуса, доступные title/description. |
| `DataTable` — B `src/components/data-table.tsx` | 10, 15, списки админки | B-only. Серверные фильтры/пагинация остаются на странице; data-label на td. Компонент существует, но не каждая таблица уже его использует. |
| `ListPagination`, `parseListPage` — B `src/components/list-pagination.tsx` | Личные журналы | B-only. Сохранить query-параметры и серверный ownership. |
| `SubjectIcon` — `src/components/subject-icon.tsx` | 1–3, 7, 10–12 | Оформить/расширить вариантом. Сейчас Calculator/BookOpen/Landmark/Leaf и токены. Для Σ/EN допустим типографический знак внутри существующей системы; не нужны AI-картинки и новый icon pack. |
| `RatingChart`, `Bars` — `src/components/charts.tsx` | 1, 7, 12 | Оставить Recharts и формулы данных, создать компактный визуальный variant. Не использовать рейтинговый график для случайной административной метрики. |
| `TaskControls`, B `RecalculatePlanButton` — `src/components/task-controls.tsx` | 1, 2, 8 | Сохранить реальные действия, подтверждения, pending и retry. В строке задачи не вкладывать button в Link. |
| `useActionFeedback` — B `src/components/use-action-feedback.ts` | Все mutation forms | B-only; сохраняет single-flight и видимый результат, не меняет серверный ActionState. |
| `LessonTabs`, `VideoPanel`, `CompleteLesson`, `TopicActions`, `MathText` | 4 | В B вкладки опираются на `ContentTabs`. Оформить без подмены содержимого и без удаления fallback для видео. |
| `TestRunner`, `useAttemptDraft` — `test-runner.tsx`, `use-attempt-draft.ts`; `src/lib/attempt-draft.ts` | 5, 16 | Очень чувствительный блок. Сохранить ключи черновиков, идентификаторы options, таймер и повтор завершения. |
| `QuestionFeedback`, inline формы ручной проверки в `/tests/[id]` | 6 | Сохранить handlers и серверную проверку. Их нельзя признать пустыми кнопками по отсутствию onClick. |
| `ResultEditorDialog`, `ResultDeleteButton`, `ResultForm` | 10 | Сохранить model types, нулевые/неизвестные баллы, подтверждения. |
| `NoteForm`, `NoteDeleteButton`; B offline feedback | 11 | Сохранить введённое при сетевом отказе, собственные IDs и privacy. |
| `SettingsWorkspace`, `ElectiveForm`, `SettingsForm`; B `LearningTimeForm` | 14 | Оформить текущие разделы, не открывать административные функции ученику. |
| `RoleManager`, `BackupRestoreForm`, `QuestionEditor`, `LessonEditor`, `SubjectEditor` | Admin/editor | Переиспользовать в соответствующем контексте; новый dashboard их не переносит в учебную область. |

## 3. Текущие токены и видимые расхождения

Все текущие значения ниже прочитаны из `src/app/globals.css`, а не определены по изображению.

| Назначение | O light / dark | Отличие B / требование эталона |
|---|---|---|
| Фон `--background` | `#F5F7FC` / `#080F1E` | B те же. Эталон темнее и с локальным сине-бирюзовым свечением в dark. |
| Карточка `--card` | `#FFFFFF` / `#101C31` | B те же. Нужны уровни inset/raised и деликатный градиент, без размытия текста. |
| Текст `--foreground` | `#17243D` / `#F2F6FF` | Сохранить контраст обеих тем. |
| Вторичный текст | `#63738F` / `#A5B5D0` | B light `#5B6B86` — уже затемнён ради читаемости. |
| Primary | `#326BFF` / `#326BFF` | B отдельный `--action: #2455CF`, `--color-action`, `--color-link`; прежнюю коррекцию контраста не потерять. |
| Border | `#DFE6F2` / `#263653` | Эталон тоньше/ниже по контрасту, но границы интерактивных полей должны оставаться различимыми. |
| Math / Ukrainian / History / Biology | O/B dark `#6D9AFF` / `#B6A0E8` / `#E0AF55` / `#63C69D` | Эталон: синий math, золотая Ukrainian, красная history, бирюзовая English. Это другая предметная палитра. |
| Радиус / тень | `--radius: 1rem`; Card `rounded-2xl` | Нужны компактные строки/вложенные поверхности, не один radius для всех размеров. |

Внимание: существующие `--subject-*` не подключены как `--color-subject-*` в `@theme`; иконки и линии используют CSS var напрямую. Добавление Tailwind-класса `bg-subject-history` без theme mapping не даст гарантированного результата.

В `globals.css` уже есть переопределение `.text-primary { color: var(--link) }`. Не добавлять второе случайное переопределение: разделить action/link/accent явно. Не маскировать overflow общим `overflow-x:hidden` — он уже присутствует и может скрыть дефект layout.

## 4. План единой системы

### Слой 1: семантические значения

Сохранить существующие имена и добавить при реализации: `surface-inset`, `surface-raised`, `border-subtle`, `accent-cyan`, `accent-violet`, `shadow-elevated`, `glow-primary`, subject-icon-foreground/background, компактные radii. Значения цвета/размера проектируются по коллажу и проверяются на реальном экране; они не объявляются «точно извлечёнными из Figma».

Тема и предметный цвет — разные измерения. Декоративный цвет карточки не должен менять Subject.color в SQLite. Данные, легенды и подписи продолжают обозначать тот же предмет.

### Слой 2: primitives

Один `Button` с default/outline/ghost/destructive и компактным размером; один `Card` с default/inset/hero; общий subject badge, chart frame, compact row, tabs. Добавлять variants к существующим компонентам, не отдельный набор `NewButton`/`PremiumButton` на каждый экран.

Состояния обязательны: default/hover/focus/pressed/disabled/pending/error/empty. Glow — декоративный слой с `pointer-events:none`; он не заменяет focus ring. Анимации учитывают reduced motion.

### Слой 3: композиции

Shell, hero, small subject strip, task list, chart card, results panel и desktop/mobile layouts. Для D01 будущие dashboard-композиции могут быть отдельными файлами; их нет сейчас и D00 их не создаёт.

### Слой 4: миграция по экрану

1. D01 — главная и ограниченный shell variant, контролируемо только на `/`.
2. После её приёмки — общий shell и план/предметы.
3. Урок; отдельно тест и результат, сохраняя текущий state contract.
4. Прогресс/календарь, затем результаты/материалы/настройки.
5. Admin/editor; не переносить их навигацию в ученический контекст.
6. Отдельные решения для отсутствующих функций: уведомления, внешний каталог Освіта.ua, saved materials и выделенная статистика. Их отсутствие не исправлять заглушкой.

## 5. Проверяемые визуальные правила

- Сравнивать композицию при одинаковой роли, viewport, теме и состоянии данных. Сохранённый снимок беты не является новым эталоном.
- 1440×900 — основной desktop acceptance; дополнительно 1280, 1920, 768 и 390×844/360px. У коллажа неизвестны исходные viewport, поэтому реальные размеры — спецификация адаптации, а не измерение уменьшенной картинки.
- Основной текст 14–16px, служебный минимум 12px; не копировать крошечные буквы уменьшенного коллажа в реальный интерфейс. Action targets от 40px, на touch целиться в 44px.
- Контраст текста и состояний проверять после выбора финальных цветов; не объявлять WCAG по внешнему виду. Оставить существующий доступный action-тон беты, пока новый не проверен.
- Растровые несовершенства, вымышленные имена, цифры, предметы и нечитаемые подписи коллажа не становятся продуктовой логикой.
