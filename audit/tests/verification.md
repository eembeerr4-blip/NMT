# Reliability verification

Baseline a37d8cb. C01–C09 in scope; C10 explicitly deferred, onboarding untouched.

- New draft/proxy/question unit pass: 20/20.
- Full isolated suite: **163 passed, 8 skipped**, 27 passing files, 2 skipped files (171 tests total).
- The 8 existing opt-in audit tests need a separate legacy audit dataset and remain skipped; no automatic PASS claimed.
- Every DB-writing test either overrides Prisma with a fresh temporary database, uses worktree-local prisma/test.db, or is explicitly opt-in and skipped. Default DATABASE_URL was forced to the isolated audit/tests/suite.db. No .env copied.
- Reliability integration: early Answer fault rolls back answers/mistakes/progress/reviews/sessions/XP; late achievement failure rolls back the entire result and task changes; concurrent finish and retries produce one result; stale saveDraft cannot overwrite COMPLETED; B cannot finish/save A's attempt.
- Elective integration: midway UserSettings failure rolls back tasks/membership/settings; simultaneous choices leave one elective; DONE history retained.
- Calendar integration: custom/moved/DONE survive synchronization, study-day changes and recalculation.
- Questions: real database round-trip and grading for SINGLE_CHOICE, MATCHING, SEQUENCE, NUMERIC with stable IDs; student and used-question protection.
- Theory-only lesson requires acknowledgment; empty material is rejected. SQLite integrity and foreign keys pass.

Typecheck (`npx tsc --noEmit --incremental false`) and `npm run lint`: PASS. Production build (`npm run build`) on the isolated source snapshot with its own copied dependencies: PASS. No schema or migration changes.

Chrome source SHA: **86394a35e8db56bceeaedbab73bb2038c6c0c77c** (application changes in 2b6e7a2; tooling exclusions in 86394a3). Compared all 145 tracked src files against the runnable snapshot: zero differences. Later commits contain QA evidence/docs only.

Chrome: 113 recorded observations, including 60 route/role/viewport checks (5 authenticated profiles × 6 affected routes × 2 widths), 10 anonymous route checks, two anonymous API views, mutation/recovery scenarios and a production smoke. This is focused acceptance for C01–C09, not a claim that the older 504-row whole-product matrix passed.

See [Chrome acceptance](Chrome-acceptance.md), [structured summary](chrome-summary.json), [network evidence](chrome-network.json), and [merge plan](../merge-plan.md).
