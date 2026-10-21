# Маршрути за зафіксованим commit

42 сторінки, 4 HTTP handlers. Layout не є auth-guard для HTTP handlers. Усі handlers мають власну перевірку.

| URL | Тип | Guard classification | Фактична межа | Evidence |
|---|---|---|---|---|
| /ai-tutor | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/ai-tutor/page.tsx:1 |
| /analytics | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/analytics/page.tsx:1 |
| /calendar | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/calendar/page.tsx:1 |
| /curriculum | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/curriculum/page.tsx:1 |
| /exams | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/exams/page.tsx:1 |
| /learn/[topicId] | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/learn/[topicId]/page.tsx:1 |
| /mistakes | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/mistakes/page.tsx:1 |
| /notes | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/notes/page.tsx:1 |
| / | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/page.tsx:1 |
| /results | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/results/page.tsx:1 |
| /review | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/review/page.tsx:1 |
| /search | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/search/page.tsx:1 |
| /settings | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/settings/page.tsx:1 |
| /subjects/[slug] | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/subjects/[slug]/page.tsx:1 |
| /subjects | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/subjects/page.tsx:1 |
| /tests/[id] | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/tests/[id]/page.tsx:1 |
| /tests | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/tests/page.tsx:1 |
| /topics/[id] | page | direct + inherited | requireUser + main layout session/onboarded | src/app/(main)/topics/[id]/page.tsx:1 |
| /admin/audit | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/audit/page.tsx:1 |
| /admin/lessons/[id] | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/lessons/[id]/page.tsx:1 |
| /admin/lessons | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/lessons/page.tsx:1 |
| /admin | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/page.tsx:1 |
| /admin/questions/[id] | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/questions/[id]/page.tsx:1 |
| /admin/questions | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/questions/page.tsx:1 |
| /admin/settings | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/settings/page.tsx:1 |
| /admin/subjects/[id] | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/subjects/[id]/page.tsx:1 |
| /admin/subjects | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/subjects/page.tsx:1 |
| /admin/tasks | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/tasks/page.tsx:1 |
| /admin/tests | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/tests/page.tsx:1 |
| /admin/topics/[id] | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/topics/[id]/page.tsx:1 |
| /admin/topics | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/topics/page.tsx:1 |
| /admin/users | page | direct + inherited | admin layout → requireAdministrator → rank≥3; page guard additionally applies | src/app/admin/users/page.tsx:1 |
| /api/ai/stream | handler | direct | session → configured provider | src/app/api/ai/stream/route.ts:1 |
| /api/export/backup | handler | direct | session → isOwner → owner() | src/app/api/export/backup/route.ts:1 |
| /api/export/questions | handler | direct | session → canEditContent | src/app/api/export/questions/route.ts:1 |
| /api/export/results | handler | direct | session → userId filter | src/app/api/export/results/route.ts:1 |
| /editor/lessons/[id] | page | inherited + indirect re-export | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/lessons/[id]/page.tsx:1 |
| /editor/lessons | page | inherited + indirect re-export | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/lessons/page.tsx:1 |
| /editor | page | direct + inherited | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/page.tsx:1 |
| /editor/questions | page | inherited + indirect re-export | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/questions/page.tsx:1 |
| /editor/subjects/[id] | page | inherited + indirect re-export | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/subjects/[id]/page.tsx:1 |
| /editor/subjects | page | inherited + indirect re-export | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/subjects/page.tsx:1 |
| /editor/topics/[id] | page | inherited + indirect re-export | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/topics/[id]/page.tsx:1 |
| /editor/topics | page | inherited + indirect re-export | editor layout → requireContentEditor → role rank≥2; re-export component guard also applies | src/app/editor/topics/page.tsx:1 |
| /login | page | none found | public by design | src/app/login/page.tsx:1 |
| /onboarding | page | none found | public by design | src/app/onboarding/page.tsx:1 |

src/pages, middleware.ts, parallel/intercepting/catch-all routes у commit не знайдені. src/proxy.ts є; next.config.ts не містить redirects/rewrites. Динамічні [id], [slug], [topicId] збережені; (main) не є частиною URL. Загальні відсутні URL обробляє src/app/not-found.tsx. /ai-tutor навмисно redirect до /.
