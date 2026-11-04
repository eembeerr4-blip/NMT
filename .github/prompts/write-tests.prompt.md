---
description: Write focused Vitest/Playwright tests
---
Add tests for the described behavior.

Requirements:
- Prefer Vitest unit/integration near existing patterns
- DB writes → unique temp SQLite only
- Cover happy path + at least one negative/auth failure when relevant
- Do not invent fake coverage; assert observable behavior
- Keep Playwright specs stable (roles, explicit waits already used in repo)
