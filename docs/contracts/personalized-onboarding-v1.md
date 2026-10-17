# Personalized onboarding v1

This document describes the onboarding and per-user study-plan contract implemented on the isolated `feat/personalized-onboarding` branch. It adds to the existing authentication, subject catalog, exam-result, settings, and `StudyTask` systems; it does not replace them.

## Routes

| Route | Purpose | Access |
|---|---|---|
| `/onboarding` | Resume profile setup, subject selection, diagnostics, targets, schedule, and plan creation | Public for profile creation; authenticated users resume their own setup |
| `/baseline` | View, add, or edit this user's diagnostic baseline by active subject | Authenticated |
| `/goals` | View/edit per-subject target rating scores and change the elective subject | Authenticated |
| `/settings` | Existing settings, with links to baseline and goals | Authenticated |

An onboarded user visiting `/onboarding` is redirected to `/`. The normal authenticated layout redirects incomplete profiles to onboarding.

## Persisted data

- `User.onboarded`, `onboardingStep`, `diagnosticSkipped`, and `planVersion` persist setup state.
- `UserSubject` remains the source of the four active subjects. `targetScore` stores an optional 100–200 rating-score goal for that user and subject.
- `ExamResult` remains the source of test results. `isBaseline` marks a diagnostic entry, `baselineKey` provides an idempotency key (`<userId>:<subjectId>`), and `countsTowardAverage` is false for baseline entries. Raw and rating scores are stored independently; neither is inferred from the other.
- `UserSettings` stores the user's schedule preferences and draft schedule.
- Existing `StudyTask` records are the plan output. Plan refreshes are scoped to the current user and preserve completed, skipped, and previously moved tasks.
- Existing `UserTopicProgress`, `Mistake`, `TestAttempt`, and `Answer` records provide user-specific mastery and error signals.

These are additive schema fields. In the primary worktree's current schema and SQLite database, `User.diagnosticSkipped` already exists. The new migration therefore adds only `User.onboardingStep`, `User.planVersion`, `UserSubject.targetScore`, `ExamResult.isBaseline`, and nullable `ExamResult.baselineKey`, plus a unique index on the latter. It uses `ALTER TABLE ... ADD COLUMN` and `CREATE UNIQUE INDEX` only; it does not rebuild tables or alter existing rows. `baselineKey` is nullable, so existing results do not conflict with the unique index.

The migration is `prisma/migrations/20261017220000_personalized_onboarding_additive/migration.sql`. It must be tested on a separate anonymized copy first. Do not run `reset-auth`, delete user/session records, or reset a database to apply it. It has not been applied to the primary database.

## Flow and server actions

The UI is in `src/features/onboarding/onboarding-flow.tsx`. `loadOnboardingPageData()` derives the current step and saved values from the signed-in user. The server actions in `src/server/actions.ts` are the write boundary:

1. `beginPersonalOnboarding` creates a profile through the existing authentication model.
2. `saveOnboardingSubjects` stores the three required subjects and one supported elective in `UserSubject`.
3. `saveBaselineResult`, `skipBaselineDiagnostic`, and `continueAfterDiagnostic` persist or skip diagnostic setup. Baseline writes verify the active subject belongs to the current profile.
4. `saveSubjectTargets` validates a target for each active subject.
5. `savePersonalScheduleDraft` validates and stores schedule preferences.
6. `createPersonalStudyPlan` derives weights and calls the existing plan synchronization logic; it does not generate learning content or use AI.
7. `updatePersonalTargets` and `changeElective` update an already onboarded user's own plan inputs without rewriting completed work.

The separately usable baseline and goals pages call the same server actions as onboarding. Their reads are in `src/features/personal-plan/data.ts` and `src/features/onboarding/page-data.ts`.

## Priority and schedule behavior

Priorities are deterministic and use only known values: a rating-score gap to the chosen target and the current profile's recorded mistakes/wrong answers. Unknown scores remain unknown; no score is fabricated. Coefficients are implementation parameters, not official exam guidance, and live in `src/features/personal-plan/config.ts`.

The schedule requires four distinct active subjects, 30–240 minutes per selected study day, and at least two valid weekdays. Each generated study day includes all four subjects; remaining time slots are proportionally allocated using current weights. The calendar has no new AI or personalization service.

## External diagnostics links

The following links were checked with GET requests on 2026-10-17. All returned HTTP 200 and a matching subject heading/title. Catalogs are explicitly distinguished from direct NMT test pages.

| Subject | Resource type | Result |
|---|---|---|
| Ukrainian, mathematics, history, Ukrainian literature, geography, biology, physics, English | Direct NMT test page | Confirmed |
| Chemistry | Subject catalog (`https://zno.osvita.ua/chemistry/`) | Confirmed; `/chemistry/nmt.html` returns a mathematics heading and must not be used |
| German, French, Spanish | Subject catalog | Confirmed; no direct NMT-test page was verified |

## Validation and isolation requirements

- Resolve the actor from the existing session on every authenticated write. Do not accept `userId` from client input.
- Read and mutate personal records with both the record identifier and the authenticated `userId` in the ownership check.
- Keep baseline entries excluded from ordinary result averages and preserve raw and rating score semantics.
- Keep all supported subject IDs in `subjectIdSchema`; do not narrow result entry validation to the three required subjects.
- Plan recalculation must remain user-scoped and must not delete completed, skipped, or moved tasks.
- Do not seed curricula, questions, or lessons as part of onboarding.

## Integration notes

This branch was created from commit `248620d9265907a3924bf5fd78726f2cd9f2f10c` in a separate worktree because the primary worktree was dirty and being edited independently. Before integrating it, reconcile overlapping changes in:

- `prisma/schema.prisma` — keep the current admin/role/audit/video-progress additions from the primary tree and add only the five missing onboarding columns from this migration.
- `src/server/actions.ts` — both branches changed this file substantially; preserve the primary admin/security actions while porting the onboarding actions and their ownership checks.
- `src/server/progress.ts` — retain the primary redesign's changes and merge the per-user XP and achievement scoping from onboarding.
- `src/server/sync.ts` — merge the current primary plan behavior with user-specific `UserTopicProgress` and the dropped-slot replacement logic; do not lose audit/content work.
- `src/lib/validators.ts` — retain primary security validation and ensure all supported electives remain accepted for user exam results.
- `src/app/(main)/settings/page.tsx` — merge existing redesign settings with `/baseline`, `/goals`, and the confirmed elective-change control.
- `src/app/onboarding/page.tsx` and `src/components/onboarding-wizard.tsx` — port the onboarding flow into the redesigned visual shell; do not restore the old wizard wholesale.

The primary redesigned dashboard at `src/app/(main)/page.tsx` should keep its current task/progress queries and active-subject filtering, but add per-subject targets, baseline/diagnostic status, and navigation to `/goals` and `/baseline`. It currently derives recommendation weights from legacy fixed priorities (`math`, `ukrainian`, `history`, `biology`); replace those inputs with the selected four subjects' `priorityPercent` from the personal-plan summary. Continue feeding only `countsTowardAverage` results to score calculations; baselines remain separately visible and excluded from averages.

Do not merge the worktree's old UI wholesale over newer redesign work.

### Dashboard integration

The redesigned dashboard in the primary worktree must keep its own live task, results, progress, and analytics queries, but source preparation state from the onboarding contract:

- Build the subject set from the signed-in user's active `UserSubject` rows; do not hard-code `math/ukrainian/history/biology`. A user's elective can be any supported elective.
- Fetch the current user's `ExamResult` rows, including `isBaseline`, but pass only ordinary score rows into `averageOfLatestFull`/analytics. Baselines always have `countsTowardAverage: false`; the raw/rating baseline can be displayed separately as the starting point.
- Use `getPersonalStudySummary()` for per-subject `targetScore`, baseline status, `priorityPercent`, `diagnosticStatus`, and `onboardingRequired`; or reproduce this exact user-scoped query contract in the redesigned dashboard. A `SKIPPED`/unknown diagnostic must not be displayed as zero.
- Add a clear link to `/goals` and `/baseline` from dashboard quick actions/settings. If onboarding is incomplete, retain the existing route guard to `/onboarding`.
- Existing dashboard calls to `syncPlan(user.id)` are compatible once `userId`-scoped settings exist. Ensure the dashboard does not rely on legacy global priority fields for the elective's planning share.

The build against the primary database is deliberately not performed here. After code integration, review this SQL against the deployed schema, back up the database, and apply only through the approved deployment process after the separate-copy verification.
