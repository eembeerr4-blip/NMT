# Stage 8.2 — algebra pilot

Date: 2026-11-02. Branch: `stage82/algebra-pilot`. Base: `7fc15104a88cdfc384e6f235b9f8a754974d3ce6`.

**Result: engineering safeguards verified; pilot publication and full pilot learner acceptance BLOCKED.**

## Subject review

Independently solved 12/12 pilot questions before opening their keys/explanations; all keys matched, zero mathematical corrections. Six original worked examples and six self-study tasks are correct. Added three worked examples for the previously undersupported quadratic/parameter/logarithmic prerequisites. Correct questions and difficulty labels were preserved. This is one AI review, not teacher approval or empirical difficulty calibration; some elementary distractors remain weak diagnostic evidence.

Evidence: [independent solutions and curriculum mapping](./algebra-independent-review.json). The official [2026 mathematics page](https://testportal.gov.ua/matematyka-2026/) supports the broad Numbers/Expressions and Equations/Inequalities areas. The historical program PDF is a baseline, not confirmation of NMT-2027. No official 2027 specification was found in the targeted search; parameter root-counting questions are marked as supplemental cross-topic work.

## Server changes

- Explicit `FINAL`/`DELAYED` kinds use the existing Test model; staff `saveTestSet` accepts `assessmentPurpose`. No schema migration. Existing test editing retains its kind when the optional field is omitted.
- Questions remain reserved across draft, published and archived control sets. Ordinary topic practice, diagnostics, exams and curated training sets exclude them. Training, final and delayed banks cannot overlap; previously exposed training questions cannot be reassigned as controls.
- At most one launch per user/topic/control purpose. A transaction takes SQLite's write lock before reading history or selecting questions, protecting simultaneous launches even through different sets. Resuming a saved attempt remains possible.
- DELAYED requires an actual successful FINAL for the same user/topic, no pending manual grading, at least ceil(0.8*N), disjoint questions and seven complete elapsed days. The admission timestamp is also persisted as startedAt.
- New MASTERED assignments require both independent successful controls. Training alone and editor status changes cannot bypass this evidence. Manual review is atomic; its successful completion starts the waiting interval. Already graded control answers cannot be arbitrarily regraded.
- Reserved controls do not count toward publication's existing practice 4/5/3 requirement. Approval, active-subject and content-editor/owner restrictions remain enforced.

Historical stored MASTERED rows were not recalculated or migrated. No production data was accessed.

## Actual verification

[Per-test results, all 29 unique names and execution provenance](./algebra-pilot-QA.json).

- One full targeted run: 10 prototype + 19 real-server integration scenarios; 27 passed and two related boundary/mastery assertions failed.
- Cause: application time was used for admission while SQLite supplied attempt startedAt independently. Persisting the same admission timestamp fixed this discrepancy.
- Only the two affected independent scenarios were rerun: 2 PASS, 17 excluded by the name filter. The other 27 were not rerun after that fix. This is not claimed as a fresh all-29 final run.
- TypeScript, targeted ESLint and diff check: PASS.
- Database writes/migrations used only fixture-owned temporary SQLite directories, removed after testing. A Date-only simulated clock verified the exact seven-day boundary; no real seven-day wait occurred.
- Concurrent requests were tested within the application, against both the same and different control sets. Separate-process stress testing was not performed.
- Real server flow on a separate synthetic existing lesson: availability → practice → lesson completion → final → draft/result persistence → mistakes/review → owned correction; delayed success permits MASTERED, failure/manual pending does not. This fixture is not publication evidence for the pilot.

## Publication blocker and next step

The actual imported pilot remains DRAFT. Verified practice is **9 EASY / 3 MEDIUM / 0 HARD**, so the unchanged **4/5/3** gate rejects it. The test checks that refusal; it never overwrites pilot coverage or difficulty. No lesson was published (including synthetic lessons), no production import/deployment occurred, and no browser pass is claimed.

The full pilot learner scenario is **BLOCKED**. Next task: prepare and subject-review a genuinely balanced 4/5/3 practice bank for this pilot, without relabelling easy questions to satisfy the gate; then perform isolated browser acceptance.

## Commits

- Subject review: `f174e37605123bea70dc490d387707b9d447e331`.
- Server safeguards and tests: `a4346f244ec06a165359dfd16cc29ea7e7bdaa06`.
- This report and machine-readable QA evidence are in the following documentation commit on the same branch.

Original 23 worktrees were not switched or edited. Only the new worktree was used. Publication is to this working branch only, without merge or deployment; remote SHA is verified after push and reported in the chat.
