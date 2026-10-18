# Local merge / rollout record

Base: `a37d8cb27642ab8fe1982aaf5810f42e165856a5`.
Fix branch/worktree: `fix/reliability` — `D:/Вайб-кодинг/nmt-reliability`.
Target: `cursor/nmt-academy-lessons-and-audit` — `C:/Users/User/nmt-academy`.

## Gates

- C01–C09 acceptance PASS in the documented scope; C10 deliberately deferred.
- tsc --noEmit --incremental false PASS; lint PASS; isolated suite 163 passed / 8 existing opt-in skipped.
- Chrome: six identities on 1440/390, focused role/route matrix and actual recovery/edit/calendar actions.
- Production build PASS on isolated QA; production smoke PASS.
- Runtime source checked against `86394a35e8db56bceeaedbab73bb2038c6c0c77c`: 145 files, zero differences.
- Application source is unchanged in later evidence/documentation commits.
- No changes to learning content, onboarding files/function, package versions, Prisma schema or SQL migration files.

## Schema, migration order, backup

Schema diff: **empty**. Migration diff: **empty**. This fix needs no migration, db push, seed, reset, resolve or SQL on the working database.

Repository order, deployed only to fresh QA databases:

1. 20261017083146_init
2. 20261018000000_reconcile_history
3. 20261018000100_normalize_user_video_progress
4. 20261018093650_add_query_indexes
5. 20261018130000_nickname_case_insensitive

Working migration status was not queried. No working backup/restore operation was run, in accordance with “No prod DB/migrations”. Existing backups remain untouched. For a separately authorized future data migration, first create a fresh consistent SQLite snapshot with VACUUM INTO (or an explicitly approved OWNER JSON export), verify it, and do not copy only dev.db while WAL writes may still be pending. No such operation is necessary for this source-only merge.

## Merge execution

Before merge: recheck target HEAD is still the base and tracked worktree is clean. Preserve all existing untracked audit/ and qa-audit/ artifacts. Do not reset, clean, force or overwrite an untracked conflict.

Authorized command after gates:

```powershell
git -C C:/Users/User/nmt-academy merge --ff-only fix/reliability
```

After merge: verify target and fix branch have the same HEAD; diff against baseline has no schema/migration/content/onboarding changes; run typecheck and lint in the target (audit snapshots are now excluded). Do not run integration tests against the working database. No push, PR or remote changes.

Rollback is a code revert of the implementation commits, with no database restore or schema rollback. Previously DROPPED manual tasks are not silently repaired on the working DB; this patch prevents new erroneous cancellation. Historical data repair, if needed, is a separate authorized task.

Implementation patches are in audit/patches. Detailed checks: audit/tests/verification.md and audit/tests/Chrome-acceptance.md. Final merged SHA is reported in the completion message and available with git rev-parse HEAD.
