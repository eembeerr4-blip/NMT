# Server Actions

55 module exports та 11 inline server functions (не 66 незалежних продуктових сценаріїв). Враховані form action/formAction, imports і прямі виклики; useActionState/startTransition є в raw AST calls. Передані callback props, re-export та динамічні виклики потребують ручної трасировки: відсутність прямого caller не доводить, що action мертвий.

| Символ | Вид | Guard / фактична перевірка | Evidence | Прямі references |
|---|---|---|---|---|
| inline@39 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/calendar/page.tsx:39 | немає знайденого прямого статичного caller |
| inline@67 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/mistakes/page.tsx:67 | немає знайденого прямого статичного caller |
| inline@39 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/review/page.tsx:39 | немає знайденого прямого статичного caller |
| inline@40 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/review/page.tsx:40 | немає знайденого прямого статичного caller |
| inline@44 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/review/page.tsx:44 | немає знайденого прямого статичного caller |
| inline@69 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/review/page.tsx:69 | немає знайденого прямого статичного caller |
| inline@30 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/settings/page.tsx:30 | немає знайденого прямого статичного caller |
| inline@77 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/tests/[id]/page.tsx:77 | немає знайденого прямого статичного caller |
| inline@78 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/tests/[id]/page.tsx:78 | немає знайденого прямого статичного caller |
| inline@87 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/(main)/tests/[id]/page.tsx:87 | немає знайденого прямого статичного caller |
| inline@12 | inline | indirect: перевірка у викликаному action; див. calls у AST-maps | src/app/login/page.tsx:12 | немає знайденого прямого статичного caller |
| addVideo | module export | indirect → editor → actor → session | src/server/actions.ts:87 | src/components/video-panel.tsx:22; src/components/video-panel.tsx:88 |
| updateVideo | module export | indirect → editor → actor → session | src/server/actions.ts:125 | src/components/video-panel.tsx:125 |
| deleteVideo | module export | indirect → editor → actor → session | src/server/actions.ts:146 | src/components/video-panel.tsx:122 |
| makePrimary | module export | indirect → editor → actor → session | src/server/actions.ts:164 | src/components/video-panel.tsx:116 |
| saveVideoNotes | module export | indirect → actor → session | src/server/actions.ts:183 | src/components/video-panel.tsx:131; tests/audit-database.test.ts:66; tests/audit-database.test.ts:67 |
| saveVideoPosition | module export | indirect → actor → session | src/server/actions.ts:192 | src/components/video-panel.tsx:155; src/components/video-panel.tsx:162; src/components/video-panel.tsx:185; tests/audit-database.test.ts:66; tests/audit-database.test.ts:67 |
| searchYouTube | module export | indirect → actor → session | src/server/actions.ts:204 | src/components/lesson-tutor.tsx:71; src/components/video-panel.tsx:26 |
| setVideoReview | module export | indirect → editor → actor → session | src/server/actions.ts:235 | src/components/video-panel.tsx:117; src/components/video-panel.tsx:118 |
| setVideoRole | module export | indirect → editor → actor → session | src/server/actions.ts:251 | src/components/video-panel.tsx:119 |
| saveNote | module export | indirect → actor → session | src/server/actions.ts:269 | src/components/forms.tsx:358; tests/isolation-hardening.test.ts:36; tests/isolation-hardening.test.ts:50; src/components/forms.tsx:353 |
| deleteNote | module export | indirect → actor → session | src/server/actions.ts:285 | src/components/note-delete-button.tsx:18; src/server/audit-actions.test.ts:64; tests/isolation-hardening.test.ts:50 |
| saveQuestion | module export | indirect → editor → actor → session | src/server/actions.ts:309 | src/components/forms.tsx:112; tests/audit-database.test.ts:95; src/components/forms.tsx:103 |
| deleteQuestion | module export | indirect → editor → actor → session | src/server/actions.ts:313 | src/components/question-moderation.tsx:31; tests/audit-database.test.ts:76; tests/audit-database.test.ts:90 |
| importQuestions | module export | indirect → editor → actor → session | src/server/actions.ts:322 | src/components/forms.tsx:185; tests/audit-database.test.ts:85; tests/audit-database.test.ts:87; src/components/forms.tsx:182 |
| reportQuestion | module export | indirect → actor → session | src/server/actions.ts:343 | src/components/question-feedback.tsx:4; tests/audit-database.test.ts:77 |
| verifyQuestion | module export | indirect → editor → actor → session | src/server/actions.ts:355 | src/components/question-moderation.tsx:18; tests/audit-database.test.ts:76 |
| startTopicTest | module export | indirect → actor → session | src/server/actions.ts:373 | src/app/(main)/tests/[id]/page.tsx:87; src/components/forms.tsx:245; src/components/forms.tsx:244 |
| skipDiagnostic | module export | indirect → actor → session | src/server/actions.ts:399 | src/components/diagnostic-start.tsx:20; src/components/diagnostic-start.tsx:19 |
| startDiagnostic | module export | indirect → actor → session | src/server/actions.ts:403 | src/components/diagnostic-start.tsx:15; src/components/diagnostic-start.tsx:12 |
| startExam | module export | indirect → actor → session | src/server/actions.ts:415 | src/components/forms.tsx:263; src/components/forms.tsx:259 |
| saveDraft | module export | indirect → actor → session | src/server/actions.ts:452 | src/components/test-runner.tsx:58; src/server/audit-actions.test.ts:59; tests/isolation-hardening.test.ts:49 |
| finishAttempt | module export | indirect → actor → session | src/server/actions.ts:464 | src/components/test-runner.tsx:74; src/components/test-runner.tsx:89; tests/isolation-hardening.test.ts:49 |
| completeLesson | module export | indirect → actor → session | src/server/actions.ts:589 | src/components/lesson-tutor.tsx:111; src/components/lesson-tutor.tsx:108 |
| gradeManually | module export | indirect → actor → session | src/server/actions.ts:653 | src/app/(main)/tests/[id]/page.tsx:77; src/app/(main)/tests/[id]/page.tsx:78 |
| saveExamResult | module export | indirect → actor → session | src/server/actions.ts:680 | src/components/forms.tsx:40; tests/isolation-hardening.test.ts:36; tests/isolation-hardening.test.ts:51; tests/isolation-hardening.test.ts:58; src/components/forms.tsx:39 |
| deleteExamResult | module export | indirect → actor → session | src/server/actions.ts:713 | src/components/result-editor-dialog.tsx:44; tests/isolation-hardening.test.ts:51 |
| setTaskStatus | module export | indirect → actor → session | src/server/actions.ts:727 | src/components/task-controls.tsx:18; src/components/task-controls.tsx:27; src/server/audit-actions.test.ts:90; tests/isolation-hardening.test.ts:52; tests/isolation-hardening.test.ts:56; src/app/(main)/calendar/page.tsx:39; src/components/task-controls.tsx:17 |
| moveTask | module export | indirect → actor → session | src/server/actions.ts:756 | src/components/task-controls.tsx:33; tests/isolation-hardening.test.ts:52; src/components/task-controls.tsx:30 |
| createCustomTask | module export | indirect → actor → session | src/server/actions.ts:792 | src/components/forms.tsx:398; tests/isolation-hardening.test.ts:36; src/components/forms.tsx:394 |
| recalculateFuturePlan | module export | indirect → actor → session | src/server/actions.ts:815 | src/components/task-controls.tsx:54; src/server/actions.ts:514; src/server/audit-actions.test.ts:83; src/components/task-controls.tsx:51 |
| logStudyMinutes | module export | indirect → actor → session | src/server/actions.ts:830 | src/components/forms.tsx:381; src/server/audit-actions.test.ts:53; src/components/forms.tsx:378 |
| completeReview | module export | indirect → actor → session | src/server/actions.ts:855 | src/app/(main)/review/page.tsx:69; src/server/audit-actions.test.ts:98 |
| reviewFlashcard | module export | indirect → actor → session | src/server/actions.ts:867 | src/app/(main)/review/page.tsx:39; src/app/(main)/review/page.tsx:40; src/server/audit-actions.test.ts:70; src/server/audit-actions.test.ts:77; tests/isolation-hardening.test.ts:53; tests/isolation-hardening.test.ts:57 |
| saveFlashcard | module export | indirect → actor → session | src/server/actions.ts:889 | src/app/(main)/review/page.tsx:44; src/server/audit-actions.test.ts:48 |
| setMistakeMeta | module export | indirect → actor → session | src/server/actions.ts:911 | src/app/(main)/mistakes/page.tsx:67; tests/isolation-hardening.test.ts:53 |
| savePreferences | module export | indirect → actor → session | src/server/actions.ts:922 | src/components/forms.tsx:291; src/components/forms.tsx:290 |
| saveSchedule | module export | indirect → administrator → actor → session | src/server/actions.ts:955 | src/server/audit-actions.test.ts:109 |
| saveFormat | module export | indirect → administrator → actor → session | src/server/actions.ts:973 | src/server/audit-actions.test.ts:113 |
| saveSecretSettings | module export | indirect → administrator → actor → session | src/server/actions.ts:993 | немає знайденого прямого статичного caller |
| enableLocalTutor | module export | indirect → actor → session | src/server/actions.ts:1015 | src/components/lesson-tutor.tsx:96 |
| askTutor | module export | indirect → actor → session | src/server/actions.ts:1024 | немає знайденого прямого статичного caller |
| saveGeneratedQuestions | module export | indirect → editor → actor → session | src/server/actions.ts:1034 | немає знайденого прямого статичного caller |
| buildBackup | module export | indirect → owner → actor → session | src/server/actions.ts:1052 | src/app/api/export/backup/route.ts:11; src/server/audit-actions.test.ts:104; src/server/audit-actions.test.ts:158; src/server/role-database.test.ts:44; tests/audit-database.test.ts:38; tests/isolation-hardening.test.ts:62 |
| restoreBackup | module export | indirect → owner → actor → session | src/server/actions.ts:1084 | src/components/backup-restore.tsx:21; src/server/audit-actions.test.ts:105; src/server/audit-actions.test.ts:158; src/server/role-database.test.ts:44; tests/audit-database.test.ts:44; tests/audit-database.test.ts:60; tests/isolation-hardening.test.ts:62 |
| login | module export | public; input/password validation | src/server/actions.ts:1151 | src/app/login/page.tsx:15 |
| logout | module export | optional session; removes current token | src/server/actions.ts:1169 | src/app/admin/layout.tsx:34; src/components/app-shell.tsx:141 |
| claimOwner | module export | conditional bootstrap: Host prefix + owner with empty password | src/server/actions.ts:1176 | src/components/onboarding-wizard.tsx:36 |
| completeOnboarding | module export | public; input/password validation | src/server/actions.ts:1185 | src/components/onboarding-wizard.tsx:24; src/server/audit-actions.test.ts:122 |
| changeElective | module export | indirect → actor → session | src/server/actions.ts:1281 | src/app/(main)/settings/page.tsx:30 |
| updateTopic | module export | indirect → editor → actor → session | src/server/actions.ts:1312 | src/components/forms.tsx:203; src/components/forms.tsx:199 |
| createTopic | module export | indirect → editor → actor → session | src/server/actions.ts:1339 | src/components/forms.tsx:227; src/components/forms.tsx:223 |
| resetScheduleToDefault | module export | indirect → actor → session | src/server/actions.ts:1367 | немає знайденого прямого статичного caller |
| saveLessonContent | module export | indirect → editor → actor → session | src/server/actions.ts:1383 | src/components/lesson-editor.tsx:22; src/components/lesson-editor.tsx:16 |
| updateUserRole | module export | indirect → administrator → actor → session | src/server/actions.ts:1398 | src/components/role-manager.tsx:39; src/server/audit-actions.test.ts:133; src/server/audit-actions.test.ts:136; src/server/audit-actions.test.ts:139; src/server/audit-actions.test.ts:140; src/server/audit-actions.test.ts:144; src/server/audit-actions.test.ts:145; src/server/audit-actions.test.ts:147; src/server/audit-actions.test.ts:151; src/server/audit-actions.test.ts:155 |
| saveSubjectDetails | module export | direct → session + canEditContent | src/server/content-actions.ts:10 | src/components/subject-editor.tsx:8; src/server/content-actions.test.ts:10; src/server/content-actions.test.ts:11; src/server/content-actions.test.ts:12; src/server/content-actions.test.ts:13 |

saveSecretSettings, askTutor, saveGeneratedQuestions, resetScheduleToDefault не мають знайденого прямого caller у цьому інвентарі. AI UI зараз не підключений: /ai-tutor redirect, LessonTutor не монтується з уроку. Їх не оголошено «мертвими»; потрібні окрема перевірка інтеграцій і рішення про feature policy.
