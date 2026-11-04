# NMT Academy

Read the root and any nearer AGENTS.md, ARCHITECTURE.md and PLAN.md before changes. Resolve stale documentation against current code and the owner's current request. For local coding, also read C:/Users/User/.codex/skills/karpathy-guidelines/SKILL.md when available; do not assume that Windows file exists in Codespaces.

Use the existing Next.js App Router, React, TypeScript and Prisma/SQLite architecture. Read relevant installed Next.js documentation under node_modules/next/dist/docs before changing framework code. Keep changes scoped; explain assumptions and define a concrete verification before implementation.

Registration requires email verification and owner approval in /admin/moderation. Preserve server-side role and record ownership checks: hidden UI is not authorization. Trace route → component → server action → guard → Prisma → userId/role.

Never read out .env values, tokens, password hashes, private backups or student records. Never use prisma/dev.db for tests, run production migrations/seed/db push, or remove its WAL/SHM. Inspect scripts before running them. Use only disposable QA databases. Never overwrite other worktrees or uncommitted work; never reset/clean/force push. Production deployment requires owner approval.

Use targeted regression tests for behavioral changes, then typecheck; run broad checks for infrastructure changes or release preparation. Do not replace meaningful tests with mocks merely to get a green result. Report configured, executed, skipped and blocked separately. A successful build does not prove a live external integration.
