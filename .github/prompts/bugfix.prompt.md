---
description: Surgical bugfix workflow
---
Fix the described bug with a minimal diff.

Rules:
- Reproduce with a targeted Vitest or Playwright check when feasible
- Use disposable SQLite for any DB write
- Preserve auth/permission guards
- Do not touch working `prisma/dev.db` or `.env`
- Add/adjust only the smallest test that locks the fix
- Summarize root cause, files changed, and verification commands
