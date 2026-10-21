# Запити без буквального userId у аргументі

Це кандидати AST, а не список витоків. Спільні Topic/Question/Subject не потребують userId. Answer/AIMessage перевіряються через батьківський запис. Перевірено також непрямі фільтри, tokenHash і адміністративні bulk-операції.

| Evidence | Query | Контекст | Disposition | Підстава |
|---|---|---|---|---|
| src/app/(main)/mistakes/page.tsx:31 | prisma.mistake.findMany | MistakesPage | Indirect filter object | where contains userId at 16 |
| src/app/(main)/review/page.tsx:13 | prisma.reviewSchedule.findMany | ReviewPage | Indirect filter object | mine = {userId:user.id} at 11 |
| src/app/(main)/review/page.tsx:14 | prisma.reviewSchedule.findMany | ReviewPage | Indirect filter object | mine = {userId:user.id} at 11 |
| src/app/(main)/review/page.tsx:15 | prisma.reviewSchedule.findMany | ReviewPage | Indirect filter object | mine = {userId:user.id} at 11 |
| src/app/(main)/review/page.tsx:17 | prisma.reviewSchedule.findMany | ReviewPage | Indirect filter object | mine = {userId:user.id} at 11 |
| src/app/admin/tasks/page.tsx:32 | prisma.studyTask.count | inline@32 | ADMIN-wide, не STUDENT ownership | requireAdministrator + admin layout |
| src/app/admin/tasks/page.tsx:33 | prisma.studyTask.findMany | AdminTasksPage | ADMIN-wide, не STUDENT ownership | requireAdministrator + admin layout |
| src/app/admin/tasks/page.tsx:40 | prisma.studyTask.count | AdminTasksPage | ADMIN-wide, не STUDENT ownership | requireAdministrator + admin layout |
| src/app/api/ai/stream/route.ts:65 | prisma.aIMessage.createMany | save | Conversation child of current actor | save(user.id), conversation created with userId at 62–66 |
| src/server/actions.ts:473 | prisma.answer.deleteMany | finishAttempt | Indirect attempt ownership | attempt.id + userId checked at 467–471 |
| src/server/actions.ts:482 | prisma.answer.create | finishAttempt | Indirect attempt ownership | attempt.id + userId checked at 467–471 |
| src/server/actions.ts:511 | prisma.answer.findMany | finishAttempt | Indirect attempt ownership | attempt.id + userId checked at 467–471 |
| src/server/actions.ts:586 | prisma.studyTask.update | completeOpenTask | Internal derived id | task selected with userId at 581–583 |
| src/server/actions.ts:662 | prisma.answer.findMany | gradeManually | Indirect answer ownership | answer update has attempt.userId at 656–660 |
| src/server/actions.ts:929 | tx.userSettings.update | inline@925 | Settings id derived from session user | getSettings(user.id), role guard where relevant |
| src/server/actions.ts:963 | tx.userSettings.update | inline@958 | Settings id derived from session user | getSettings(user.id), role guard where relevant |
| src/server/actions.ts:983 | tx.userSettings.update | inline@976 | Settings id derived from session user | getSettings(user.id), role guard where relevant |
| src/server/actions.ts:1054 | prisma.userSubject.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1054 | prisma.userTopicProgress.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1054 | prisma.userVideoProgress.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1056 | prisma.userSettings.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1061 | prisma.note.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1066 | prisma.testAttempt.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1067 | prisma.answer.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1068 | prisma.examResult.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1069 | prisma.studySession.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1070 | prisma.studyTask.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1071 | prisma.reviewSchedule.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1072 | prisma.mistake.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1073 | prisma.flashcard.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1074 | prisma.aIConversation.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1075 | prisma.aIMessage.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1076 | prisma.achievement.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1077 | prisma.xpEvent.findMany | buildBackup | OWNER bulk export | owner() at 1053 |
| src/server/actions.ts:1091 | tx.answer.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1093 | tx.testAttempt.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1095 | tx.mistake.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1096 | tx.reviewSchedule.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1097 | tx.studyTask.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1098 | tx.studySession.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1100 | tx.note.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1103 | tx.flashcard.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1104 | tx.xpEvent.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1105 | tx.aIConversation.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1106 | tx.examResult.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1109 | tx.achievement.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1111 | tx.userSettings.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1112 | tx.session.deleteMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1116 | tx.userSettings.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1118 | tx.userSubject.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1119 | tx.userTopicProgress.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1123 | tx.note.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1125 | tx.userVideoProgress.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1126 | tx.flashcard.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1129 | tx.testAttempt.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1130 | tx.answer.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1131 | tx.examResult.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1132 | tx.studySession.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1133 | tx.studyTask.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1134 | tx.reviewSchedule.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1135 | tx.mistake.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1136 | tx.aIConversation.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1137 | tx.aIMessage.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1138 | tx.achievement.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1139 | tx.xpEvent.createMany | inline@1090 | OWNER restore inside transaction | owner() 1086 + confirmation 1087 |
| src/server/actions.ts:1163 | prisma.session.deleteMany | login | Expired-session cleanup | expiresAt < now, not private-data disclosure |
| src/server/actions.ts:1294 | prisma.userSubject.update | changeElective | Subject row derived from session | user.subjects at 1286 |
| src/server/actions.ts:1373 | tx.userSettings.update | inline@1370 | Settings id derived from session user | getSettings(user.id), role guard where relevant |
| src/server/progress.ts:39 | prisma.achievement.findMany | refreshAchievements | Shared achievement template / namespaced personal id | 39–46, id = user.id:template.id; existing owner special case |
| src/server/progress.ts:43 | tx.achievement.findUnique | inline@42 | Shared achievement template / namespaced personal id | 39–46, id = user.id:template.id; existing owner special case |
| src/server/session.ts:34 | prisma.session.deleteMany | clearSession | Authentication by token hash | cookie token hash, expiry checked; passwordHash omitted |
| src/server/session.ts:42 | prisma.session.findUnique | inline@38 | Authentication by token hash | cookie token hash, expiry checked; passwordHash omitted |
| src/server/sync.ts:13 | prisma.userSettings.findUnique | getSettings | Anonymous default fallback: technical debt | getSettings 9–13; not a Server Action |
| src/server/sync.ts:58 | prisma.studyTask.update | inline@23 | Internal derived task id, not client input | source query scoped by ownerId/userId at 35–36 or 106–107 |
| src/server/sync.ts:79 | prisma.studyTask.update | inline@23 | Internal derived task id, not client input | source query scoped by ownerId/userId at 35–36 or 106–107 |
| src/server/sync.ts:83 | prisma.studyTask.update | inline@23 | Internal derived task id, not client input | source query scoped by ownerId/userId at 35–36 or 106–107 |
| src/server/sync.ts:112 | prisma.studyTask.update | shiftOverdue | Internal derived task id, not client input | source query scoped by ownerId/userId at 35–36 or 106–107 |
| src/server/sync.ts:121 | prisma.studyTask.update | shiftOverdue | Internal derived task id, not client input | source query scoped by ownerId/userId at 35–36 or 106–107 |

Схемний техборг: nullable userId та відсутній User FK у частини особистих моделей (Note, TestAttempt, ExamResult, StudyTask тощо). Це не доводить міжкористувацький витік; створює ризик orphan records для майбутніх scripts/import. Зміни схеми в цьому аудиті не виконувались. getSettings fallback не експортований як Server Action. Запити тільки по id у планувальнику отримують id із попередньої user-scoped вибірки; посилення where корисне як defense in depth.

Raw SQL у login/completeOnboarding перевірено окремо: tagged Prisma query, параметризований nickname COLLATE NOCASE. Ця AST-карта не є повним SQL query planner і не замінює майбутніх тестів A/B на disposable DB.
