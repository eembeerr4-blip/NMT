# NMT reliability fixes

Baseline: a37d8cb27642ab8fe1982aaf5810f42e165856a5. Branch: fix/reliability.
Worktree: D:/Вайб-кодинг/nmt-reliability.

Scope: C01–C09. C10 deferred: the explicit instruction “onboarding не рухати” takes precedence. No content, onboarding branch, production database, schema or migration changes.

| Block | Scope | Acceptance |
|---|---|---|
| B01 P1 M | C01 local/server draft recovery and save status | Immediate reload restores edits; failed saves retain local data; stale acknowledgements do not discard new edits. |
| B02 P1 L | C02 transaction/CAS/idempotent finish | Fault rolls back answers/progress/XP; concurrent and repeated finish produce one result. |
| B03 P1 M | C03 timer and retry | Failed finish shows error and retry; local draft is removed only on success. |
| B04 P1 M | C04 calendar provenance | Custom/moved/DONE survive sync and recalculation. |
| B05 P2 S | C05 editor route | Editor can edit through /editor; student denied; admin return stays /admin. |
| B06 P2 L | C06 option identity roundtrip | Text-only edit preserves a valid answer for all supported types; used question remains protected. |
| B07 P2 M | C07 theory-only completion | Theory without verified questions can complete after explicit acknowledgement; empty lesson cannot. |
| B08 P2 M | C08/C09 elective transaction + API contract | Fault preserves elective/tasks/schedule; action errors visible; unauthenticated API returns JSON 401. |

Sequence: isolated QA schema deployment → implementation → unit/integration fault/race/ownership → tsc --noEmit --incremental false / lint / isolated npm test → Chrome → commit SHA → merge only after acceptance. No push. No production migration/restore.

Artifacts: audit/patches, audit/tests, audit/merge-plan.md. Record actual results and remaining limits, never transfer the old 504-row matrix to PASS without executing it.
