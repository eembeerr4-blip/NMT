# Карта серверных действий и HTTP handlers

AST-инвентаризация текущего рабочего кода; inline Server Actions включены. Автоматическое определение guard — карта вызовов, не самостоятельное доказательство защиты. Negative coverage: permissions-matrix.test.ts; ownership: isolation-hardening/reliability suites. Для public login/onboarding/bootstrap применяются отдельные контракты.

| Файл:строка | Действие | Тип | Guard/цепочка | Область данных | Негативная проверка |
|---|---|---|---|---|---|
| src/app/(main)/mistakes/page.tsx:67 | inline@67 | inline | indirect: setMistakeMeta → session / own data | verify userId or parent chain (see isolation tests) | через вызываемое действие; wrapper отдельно не доказан |
| src/app/(main)/tests/[id]/page.tsx:79 | inline@79 | inline | indirect: gradeManually → session / own data | verify userId or parent chain (see isolation tests) | через вызываемое действие; wrapper отдельно не доказан |
| src/app/(main)/tests/[id]/page.tsx:80 | inline@80 | inline | indirect: gradeManually → session / own data | verify userId or parent chain (see isolation tests) | через вызываемое действие; wrapper отдельно не доказан |
| src/app/(main)/tests/[id]/page.tsx:89 | inline@89 | inline | indirect: startTopicTest → session / own data | verify userId or parent chain (see isolation tests) | через вызываемое действие; wrapper отдельно не доказан |
| src/app/api/ai/stream/route.ts:19 | POST | HTTP | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/app/api/export/backup/route.ts:7 | GET | HTTP | OWNER | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/app/api/export/questions/route.ts:8 | GET | HTTP | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/app/api/export/results/route.ts:6 | GET | HTTP | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/app/login/page.tsx:12 | inline@12 | inline | indirect: login → public contract | verify userId or parent chain (see isolation tests) | через вызываемое действие; wrapper отдельно не доказан |
| src/server/actions.ts:90 | addVideo | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:128 | updateVideo | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:149 | deleteVideo | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:167 | makePrimary | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:186 | saveVideoNotes | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:195 | saveVideoPosition | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:208 | searchYouTube | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:239 | setVideoReview | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:255 | setVideoRole | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:273 | saveNote | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:289 | deleteNote | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:319 | saveQuestion | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:323 | deleteQuestion | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:332 | importQuestions | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:353 | reportQuestion | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:365 | verifyQuestion | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:383 | startTopicTest | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:409 | skipDiagnostic | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:413 | startDiagnostic | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:425 | startExam | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:462 | saveDraft | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:470 | finishAttempt | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:604 | completeLesson | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:669 | gradeManually | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:696 | saveExamResult | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:729 | deleteExamResult | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:743 | setTaskStatus | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:772 | moveTask | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:808 | createCustomTask | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:833 | recalculateFuturePlan | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:844 | logStudyMinutes | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:869 | completeReview | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:881 | reviewFlashcard | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:903 | saveFlashcard | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:925 | setMistakeMeta | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:936 | savePreferences | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:969 | saveSchedule | action | ADMIN+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:987 | saveFormat | action | ADMIN+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1007 | saveSecretSettings | action | ADMIN+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1029 | enableLocalTutor | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1038 | askTutor | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1048 | saveGeneratedQuestions | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1066 | buildBackup | action | OWNER | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1098 | restoreBackup | action | OWNER | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1165 | login | action | public password verification | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1183 | logout | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1190 | claimOwner | action | bootstrap: local host + owner without password | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1199 | completeOnboarding | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1295 | changeElective | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1330 | updateTopic | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1357 | createTopic | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1385 | resetScheduleToDefault | action | session / own data | verify userId or parent chain (see isolation tests) | isolation/auth/proxy tests; см. отчёт |
| src/server/actions.ts:1401 | saveLessonContent | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/actions.ts:1416 | updateUserRole | action | ADMIN+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |
| src/server/content-actions.ts:10 | saveSubjectDetails | action | EDITOR+ | shared/system; role checked | permissions-matrix (direct guards); role-database; route tests |

## Запросы и ограничения

Полные аргументы запросов (без runtime-значений) в JSON. where только по id для общих Topic/Question/VideoLesson защищён редакторской ролью. Личные Answer проверяются через владельца TestAttempt; UserVideoProgress через compound userId_videoId; Note/ExamResult/StudyTask/Review/Flashcard/Mistake — через userId. Внутренние planner ids получены из выборки текущего пользователя. Отсутствие userId в одном where без контекста не названо утечкой.
