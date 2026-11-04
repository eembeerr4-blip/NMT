# NMT Academy — GitHub Copilot instructions

You are assisting on **NMT Academy**: a Next.js 16 App Router learning platform (React 19, TypeScript, Prisma 6, SQLite, Vitest, Playwright).

Read `AGENTS.md` and `ARCHITECTURE.md` before non-trivial changes. Prefer current code over outdated docs.

## Product boundaries

- Subjects: Ukrainian, Math, History, Biology (+ optional electives as scaffold).
- Auth: email verification + owner moderation in `/admin/moderation` before learning access. Do **not** reintroduce invite-only or open unmoderated access unless the owner explicitly decides.
- Content packages use format `nmt-content-package` (`docs/content/CONTENT_PACKAGE_SPEC.md`). New lessons import as DRAFT; never auto-publish.

## Hard safety rules

1. **Never** run migrate/reset/seed/push/upgrade against working `prisma/dev.db` (or its WAL/SHM) without explicit owner permission.
2. Integration tests that write must use **disposable** SQLite only. Prove `DATABASE_URL` points at a temp file; do not print secrets.
3. Never commit or print `.env`, tokens, OAuth secrets, `passwordHash`, working DB dumps, or full owner JSON backups.
4. Do not `git push`, `merge`, `reset --hard`, `clean`, or force-push unless the owner explicitly asks.
5. Do not rewrite Ukrainian or Math academic content packages from parallel content agents unless the task is content-specific.
6. Server actions and APIs must enforce `userId` + role (`OWNER` > `ADMIN` > `EDITOR` > `STUDENT`) end-to-end. Hidden UI is not a security control.

## Stack conventions

- Next.js 16 docs live under `node_modules/next/dist/docs/` — read them before using unfamiliar APIs.
- App routes: `src/app`. Server logic: `src/server`. Shared rules: `src/lib`. UI: `src/components`.
- Prefer surgical diffs. Match existing style. No speculative abstractions.
- Prisma schema is source of truth for models. Migrations exist under `prisma/migrations`; presence ≠ applied on every DB.
- KaTeX/math text uses project helpers; do not invent a second math renderer.

## Testing expectations

- Unit: Vitest (`src/**/*.test.ts`, `tests/**/*.test.ts`).
- DB tests: unique temp SQLite; never the working DB.
- E2E: Playwright configs (`playwright*.config.ts`); prefer targeted specs.
- After auth/permissions/data changes: negative cases + role checks + typecheck.
- Mark incomplete checks as SKIPPED with reason — never as PASS.

## Infrastructure integrations

- Sentry is optional via env (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`). If unset, the app must still build and run.
- Codecov uploads from CI using `CODECOV_TOKEN` when present.
- Secrets belong in GitHub Actions secrets / Vercel env / 1Password — never in source.

## Response style for Copilot Chat

- State assumptions; do not invent “official NMT-2027” specs if only 2026 UCOYA docs exist.
- Prefer minimal patches with verification steps.
- Ukrainian UI copy for learners; technical docs may be Ukrainian or English — match the file.
