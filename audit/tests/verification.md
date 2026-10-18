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

Chrome acceptance and final SHA will be recorded after the source commit. No schema or migration changes.
