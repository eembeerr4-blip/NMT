---
description: Code review checklist for NMT Academy PRs
---
Review the current diff as a senior reviewer.

Check:
1. Correctness and edge cases
2. AuthZ: role + ownership on every server path
3. No secrets, no production DB operations
4. Prisma queries scoped correctly
5. Content packages remain REVIEW/DRAFT unless explicitly publishing
6. Tests: disposable DB, meaningful assertions
7. Next.js 16 API usage vs local docs

Output: blocking issues first, then non-blocking suggestions. Prefer evidence over style nits.
