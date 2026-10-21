# Кнопки й форми — статична карта

406 JSX controls, із них 147 button/Button. Це кількість вузлів у вихідних файлах, не число видимих кнопок: враховуються reusable компоненти та умовні гілки. Список усіх 406 із props/form owner — AST-maps.json. Працездатність у браузері не перевірялася.

| Evidence | Статична поведінка | Текст/вміст |
|---|---|---|
| src/app/(main)/calendar/page.tsx:37 | asChild → дочірній Link/Slot; не no-op | <Link href={`/calendar?view=${key}&date=${anchor}`} aria-current={view===key?"page":undefined}>{label}</Link> |
| src/app/(main)/calendar/page.tsx:37 | asChild → дочірній Link/Slot; не no-op | <Link href={`/calendar?view=${view}&date=${previous}`} aria-label="Попередній період"><ChevronLeft/></Link> |
| src/app/(main)/calendar/page.tsx:37 | asChild → дочірній Link/Slot; не no-op | <Link href={`/calendar?view=${view}&date=${next}`} aria-label="Наступний період"><ChevronRight/></Link> |
| src/app/(main)/calendar/page.tsx:39 | form owner знайдений; submit-context перевірити з type | Позначити пропущеним |
| src/app/(main)/error.tsx:8 | onClick знайдений; див. handler | Спробувати знову |
| src/app/(main)/mistakes/page.tsx:45 | form owner знайдений; submit-context перевірити з type | Застосувати фільтри |
| src/app/(main)/mistakes/page.tsx:72 | form owner знайдений; submit-context перевірити з type | Зберегти стан |
| src/app/(main)/notes/page.tsx:42 | asChild → дочірній Link/Slot; не no-op | <Link href={`/topics/${note.topicId}`}>Відкрити тему</Link> |
| src/app/(main)/page.tsx:79 | asChild → дочірній Link/Slot; не no-op | <Link href={todayTopic?`/learn/${todayTopic.id}`:"/subjects"}>{todayTopic?"Продовжити урок":"Обрати предмет"}<ArrowRight className="h-4 w-4"/></Link> |
| src/app/(main)/page.tsx:84 | asChild → дочірній Link/Slot; не no-op | <Link href="/results#add">Додати результат</Link> |
| src/app/(main)/results/page.tsx:23 | asChild → дочірній Link/Slot; не no-op | <Link href="/results?add=1">Додати результат</Link> |
| src/app/(main)/results/page.tsx:46 | asChild → дочірній Link/Slot; не no-op | <Link href={`/results?edit=${encodeURIComponent(result.id)}`}>Виправити результат</Link> |
| src/app/(main)/review/page.tsx:39 | form owner знайдений; submit-context перевірити з type | Повторити |
| src/app/(main)/review/page.tsx:40 | form owner знайдений; submit-context перевірити з type | Знаю |
| src/app/(main)/review/page.tsx:49 | form owner знайдений; submit-context перевірити з type | Додати картку |
| src/app/(main)/review/page.tsx:69 | form owner знайдений; submit-context перевірити з type | Позначено |
| src/app/(main)/search/page.tsx:13 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/(main)/settings/page.tsx:35 | form owner знайдений; submit-context перевірити з type | Змінити предмет |
| src/app/(main)/tests/[id]/page.tsx:77 | form owner знайдений; submit-context перевірити з type | Зарахувати |
| src/app/(main)/tests/[id]/page.tsx:78 | form owner знайдений; submit-context перевірити з type | Не зарахувати |
| src/app/(main)/tests/[id]/page.tsx:88 | form owner знайдений; submit-context перевірити з type | Пройти новий варіант |
| src/app/(main)/tests/page.tsx:8 | asChild → дочірній Link/Slot; не no-op | <Link href="/subjects">Обрати тему для тесту</Link> |
| src/app/(main)/topics/[id]/page.tsx:41 | asChild → дочірній Link/Slot; не no-op | <Link href={`/learn/${topic.id}`}>Відкрити урок →</Link> |
| src/app/admin/audit/page.tsx:44 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/admin/layout.tsx:34 | form owner знайдений; submit-context перевірити з type | Вийти |
| src/app/admin/lessons/[id]/page.tsx:15 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/lessons`}>До списку уроків</Link> |
| src/app/admin/lessons/[id]/page.tsx:15 | asChild → дочірній Link/Slot; не no-op | <Link href={`/learn/${id}`}>Переглянути як учень</Link> |
| src/app/admin/lessons/[id]/page.tsx:15 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/topics/${id}`}>Опис теми та формули</Link> |
| src/app/admin/lessons/page.tsx:60 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/admin/lessons/page.tsx:60 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/lessons`}>Скинути</Link> |
| src/app/admin/lessons/page.tsx:76 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/lessons/${topic.id}`}>Редактор</Link> |
| src/app/admin/lessons/page.tsx:76 | asChild → дочірній Link/Slot; не no-op | <Link href={`/learn/${topic.id}`}>Як учень</Link> |
| src/app/admin/lessons/page.tsx:83 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page - 1)}>Назад</Link> |
| src/app/admin/lessons/page.tsx:83 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page + 1)}>Далі</Link> |
| src/app/admin/questions/[id]/page.tsx:20 | asChild → дочірній Link/Slot; не no-op | <Link href="/admin/questions">До банку завдань</Link> |
| src/app/admin/questions/[id]/page.tsx:21 | asChild → дочірній Link/Slot; не no-op | <Link href={`/learn/${question.topicId}`}>Переглянути як учень</Link> |
| src/app/admin/questions/page.tsx:49 | asChild → дочірній Link/Slot; не no-op | <a href="/api/export/questions">Експорт</a> |
| src/app/admin/questions/page.tsx:60 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/admin/questions/page.tsx:60 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/questions`}>Скинути</Link> |
| src/app/admin/questions/page.tsx:70 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/questions/${question.id}`}>Редагувати</Link> |
| src/app/admin/questions/page.tsx:80 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page - 1)}>Назад</Link> |
| src/app/admin/questions/page.tsx:80 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page + 1)}>Далі</Link> |
| src/app/admin/subjects/[id]/page.tsx:9 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/subjects`}>До предметів</Link> |
| src/app/admin/tasks/page.tsx:54 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/admin/tasks/page.tsx:54 | asChild → дочірній Link/Slot; не no-op | <Link href="/admin/tasks">Скинути</Link> |
| src/app/admin/tasks/page.tsx:73 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page - 1)}>Назад</Link> |
| src/app/admin/tasks/page.tsx:73 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page + 1)}>Далі</Link> |
| src/app/admin/tests/page.tsx:41 | asChild → дочірній Link/Slot; не no-op | <Link href="/admin/questions">Відкрити банк запитань</Link> |
| src/app/admin/tests/page.tsx:48 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/admin/tests/page.tsx:48 | asChild → дочірній Link/Slot; не no-op | <Link href="/admin/tests">Скинути</Link> |
| src/app/admin/tests/page.tsx:62 | asChild → дочірній Link/Slot; не no-op | <Link href={`/tests/${test.id}`}>Переглянути як учень</Link> |
| src/app/admin/tests/page.tsx:69 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page - 1)}>Назад</Link> |
| src/app/admin/tests/page.tsx:69 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page + 1)}>Далі</Link> |
| src/app/admin/topics/[id]/page.tsx:14 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/topics`}>До списку тем</Link> |
| src/app/admin/topics/[id]/page.tsx:14 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/lessons/${id}`}>Редагувати матеріал і відео уроку</Link> |
| src/app/admin/topics/page.tsx:49 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/admin/topics/page.tsx:49 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/topics`}>Скинути</Link> |
| src/app/admin/topics/page.tsx:62 | asChild → дочірній Link/Slot; не no-op | <Link href={`${base}/topics/${topic.id}`}>Відкрити редактор</Link> |
| src/app/admin/topics/page.tsx:68 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page - 1)}>Назад</Link> |
| src/app/admin/topics/page.tsx:68 | asChild → дочірній Link/Slot; не no-op | <Link href={pageUrl(page + 1)}>Далі</Link> |
| src/app/admin/users/page.tsx:45 | asChild → дочірній Link/Slot; не no-op | <Link href={filterUrl(role)} aria-current={selectedRole===role?"page":undefined}>{label}{role?` · ${totals[role]}`:` · ${allUsers}`}</Link> |
| src/app/admin/users/page.tsx:46 | form owner знайдений; submit-context перевірити з type | Знайти |
| src/app/admin/users/page.tsx:46 | asChild → дочірній Link/Slot; не no-op | <Link href="/admin/users">Скинути</Link> |
| src/app/admin/users/page.tsx:50 | asChild → дочірній Link/Slot; не no-op | <Link href={filterUrl(selectedRole,page-1)}>Назад</Link> |
| src/app/admin/users/page.tsx:50 | asChild → дочірній Link/Slot; не no-op | <Link href={filterUrl(selectedRole,page+1)}>Далі</Link> |
| src/app/editor/layout.tsx:1 | asChild → дочірній Link/Slot; не no-op | <Link href="/">До навчання</Link> |
| src/app/editor/layout.tsx:1 | asChild → дочірній Link/Slot; не no-op | <Link href={"/editor/"+route}>{label}</Link> |
| src/components/app-shell.tsx:141 | form owner знайдений; submit-context перевірити з type | Вийти |
| src/components/backup-restore.tsx:26 | asChild → дочірній Link/Slot; не no-op | <a href="/api/export/backup"><Download className="h-4 w-4"/>Завантажити копію</a> |
| src/components/backup-restore.tsx:30 | form owner знайдений; submit-context перевірити з type | <Upload className="h-4 w-4"/>{pending?"Відновлення…":"Відновити з копії"} |
| src/components/backup-restore.tsx:33 | onClick знайдений; див. handler | Скасувати |
| src/components/backup-restore.tsx:33 | onClick знайдений; див. handler | {pending?"Відновлення…":"Так, замінити дані"} |
| src/components/diagnostic-start.tsx:12 | onClick знайдений; див. handler | {busy ? "Підготовка…" : "Пройти діагностику"} |
| src/components/diagnostic-start.tsx:19 | onClick знайдений; див. handler | Пропустити |
| src/components/forms.tsx:70 | form owner знайдений; submit-context перевірити з type | {form.formState.isSubmitting ? "Збереження…" : "Зберегти результат"} |
| src/components/forms.tsx:172 | form owner знайдений; submit-context перевірити з type | {initial ? "Зберегти зміни" : "Створити завдання"} |
| src/components/forms.tsx:189 | form owner знайдений; submit-context перевірити з type | {pending?"Імпортування…":"Імпортувати JSON"} |
| src/components/forms.tsx:221 | form owner знайдений; submit-context перевірити з type | Зберегти тему |
| src/components/forms.tsx:233 | form owner знайдений; submit-context перевірити з type | Додати підтему |
| src/components/forms.tsx:248 | form owner знайдений; submit-context перевірити з type | Пройти тест |
| src/components/forms.tsx:276 | form owner знайдений; submit-context перевірити з type | Почати пробник |
| src/components/forms.tsx:315 | form owner знайдений; submit-context перевірити з type | {form.formState.isSubmitting ? "Збереження…" : "Зберегти налаштування"} |
| src/components/forms.tsx:343 | form owner знайдений; submit-context перевірити з type | Зберегти JSON |
| src/components/forms.tsx:369 | form owner знайдений; submit-context перевірити з type | {note ? "Зберегти зміни" : "Додати конспект"} |
| src/components/forms.tsx:385 | form owner знайдений; submit-context перевірити з type | Записати час |
| src/components/forms.tsx:405 | form owner знайдений; submit-context перевірити з type | Додати |
| src/components/lesson-editor.tsx:34 | form owner знайдений; submit-context перевірити з type | {busy?"Збереження…":"Зберегти матеріал"} |
| src/components/lesson-tutor.tsx:86 | onClick знайдений; див. handler | Я не зрозумів |
| src/components/lesson-tutor.tsx:88 | onClick знайдений; див. handler | {item.label} |
| src/components/lesson-tutor.tsx:90 | onClick знайдений; див. handler | Знайди інше відео |
| src/components/lesson-tutor.tsx:94 | onClick знайдений; див. handler | Запитати |
| src/components/lesson-tutor.tsx:95 | onClick знайдений; див. handler | Скасувати |
| src/components/lesson-tutor.tsx:96 | onClick знайдений; див. handler | {provider === "none" ? "Увімкнути локальну Ollama" : ""} |
| src/components/lesson-tutor.tsx:115 | form owner знайдений; submit-context перевірити з type | Завершити урок |
| src/components/login-form.tsx:22 | form owner знайдений; submit-context перевірити з type | {pending ? "Вхід…" : "Увійти"} |
| src/components/note-delete-button.tsx:32 | onClick знайдений; див. handler | {pending ? "Видалення…" : "Видалити"} |
| src/components/onboarding-wizard.tsx:35 | onClick знайдений; див. handler | Розпочати |
| src/components/onboarding-wizard.tsx:36 | form owner знайдений; submit-context перевірити з type | Це мій наявний прогрес |
| src/components/onboarding-wizard.tsx:46 | form owner знайдений; submit-context перевірити з type | Далі |
| src/components/onboarding-wizard.tsx:51 | onClick знайдений; див. handler | <span className="mb-2 block h-2 w-2 rounded-full" style={{ background: subject.color }} /><div className="font-medium">{subject.name}</div> |
| src/components/onboarding-wizard.tsx:52 | onClick знайдений; див. handler | Назад |
| src/components/onboarding-wizard.tsx:52 | onClick знайдений; див. handler | Далі |
| src/components/onboarding-wizard.tsx:56 | onClick знайдений; див. handler | {["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][day]} |
| src/components/onboarding-wizard.tsx:57 | onClick знайдений; див. handler | {item === "light" ? "Легка" : item === "intense" ? "Інтенсивна" : "Стандартна"} |
| src/components/onboarding-wizard.tsx:61 | onClick знайдений; див. handler | Назад |
| src/components/onboarding-wizard.tsx:61 | form owner знайдений; submit-context перевірити з type | Далі |
| src/components/onboarding-wizard.tsx:70 | onClick знайдений; див. handler | Назад |
| src/components/onboarding-wizard.tsx:70 | form owner знайдений; submit-context перевірити з type | {pending ? "Створення…" : "Створити план"} |
| src/components/question-feedback.tsx:4 | form owner знайдений; submit-context перевірити з type | {busy?'Надсилання…':'Надіслати'} |
| src/components/question-moderation.tsx:45 | onClick знайдений; див. handler | Відновити як чернетку |
| src/components/question-moderation.tsx:46 | onClick знайдений; див. handler | Позначити перевіреним |
| src/components/question-moderation.tsx:47 | onClick знайдений; див. handler | Архівувати |
| src/components/question-moderation.tsx:56 | onClick знайдений; див. handler | Скасувати |
| src/components/question-moderation.tsx:56 | onClick знайдений; див. handler | {busy ? "Архівування…" : "Підтвердити архівацію"} |
| src/components/result-editor-dialog.tsx:26 | підтверджена обгортка Dialog.Close asChild, onOpenChange → router.push | Скасувати |
| src/components/result-editor-dialog.tsx:59 | onClick знайдений; див. handler | {pending ? "Видалення…" : "Видалити"} |
| src/components/role-manager.tsx:100 | onClick знайдений; див. handler | {pendingUser === user.id ? "Збереження…" : "Змінити роль"} |
| src/components/role-manager.tsx:123 | onClick знайдений; див. handler | {pendingUser === user.id ? "Збереження…" : "Змінити роль"} |
| src/components/role-manager.tsx:155 | onClick знайдений; див. handler | Скасувати |
| src/components/role-manager.tsx:156 | onClick знайдений; див. handler | {pendingUser ? "Збереження…" : "Підтвердити зміну"} |
| src/components/subject-editor.tsx:8 | form owner знайдений; submit-context перевірити з type | {busy?"Збереження…":"Зберегти предмет"} |
| src/components/task-controls.tsx:17 | onClick знайдений; див. handler | Розпочати |
| src/components/task-controls.tsx:24 | asChild → дочірній Link/Slot; не no-op | <Link href={`/topics/${task.topicId}`}>Продовжити</Link> |
| src/components/task-controls.tsx:25 | asChild → дочірній Link/Slot; не no-op | <Link href="/exams">Продовжити</Link> |
| src/components/task-controls.tsx:27 | onClick знайдений; див. handler | Завершено |
| src/components/task-controls.tsx:38 | form owner знайдений; submit-context перевірити з type | Перенести |
| src/components/task-controls.tsx:51 | onClick знайдений; див. handler | {pending ? "Перерахунок…" : "Перерахувати план"} |
| src/components/test-runner.tsx:115 | onClick знайдений; див. handler | Назад |
| src/components/test-runner.tsx:116 | onClick знайдений; див. handler | Далі |
| src/components/test-runner.tsx:117 | onClick знайдений; див. handler | {pending ? "Завершення..." : "Завершити"} |
| src/components/test-runner.tsx:119 | onClick знайдений; див. handler | Повернутися до тесту |
| src/components/test-runner.tsx:119 | onClick знайдений; див. handler | {pending?"Завершення…":"Так, завершити тест"} |
| src/components/test-runner.tsx:128 | onClick знайдений; див. handler | {itemIndex + 1} |
| src/components/test-runner.tsx:193 | onClick знайдений; див. handler | Вгору |
| src/components/test-runner.tsx:194 | onClick знайдений; див. handler | Вниз |
| src/components/theme-toggle.tsx:9 | onClick знайдений; див. handler | <Sun className="hidden h-4 w-4 dark:block" /><Moon className="h-4 w-4 dark:hidden" /><span className="hidden sm:inline dark:hidden">Темна</span><span className="hidden dark:sm:inline">Світла |
| src/components/video-panel.tsx:45 | onClick знайдений; див. handler | <Play className="h-4 w-4"/>Запустити лекцію |
| src/components/video-panel.tsx:58 | onClick знайдений; див. handler | Інше пояснення |
| src/components/video-panel.tsx:79 | form owner знайдений; submit-context перевірити з type | Додати відео |
| src/components/video-panel.tsx:83 | form owner знайдений; submit-context перевірити з type | Шукати |
| src/components/video-panel.tsx:90 | form owner знайдений; submit-context перевірити з type | Додати |
| src/components/video-panel.tsx:116 | onClick знайдений; див. handler | Зробити основною |
| src/components/video-panel.tsx:117 | onClick знайдений; див. handler | Підтвердити |
| src/components/video-panel.tsx:118 | onClick знайдений; див. handler | Відхилити |
| src/components/video-panel.tsx:122 | onClick знайдений; див. handler | Видалити |
| src/components/video-panel.tsx:128 | form owner знайдений; submit-context перевірити з type | Замінити |
| src/components/video-panel.tsx:131 | onClick знайдений; див. handler | Зберегти нотатки |

Підтверджених порожніх no-op кнопок у перевірених кандидатах немає. Це не твердження, що всі 147 працюють. Справжні дефекти можуть міститися за наявним handler: див. A01–A07.

HTML-фільтри без action/onSubmit — не мертві форми: стандартний GET поточного URL читається через searchParams. Приклад src/app/admin/questions/page.tsx:55–60; filters обробляються в 19–30. button без type може бути submit, button form=… може мати зовнішню форму. Кнопки Radix/Slot/Tabs мають поведінку обгортки.
