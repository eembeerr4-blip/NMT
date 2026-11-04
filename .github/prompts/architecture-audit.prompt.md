---
description: Architecture audit for NMT Academy
---
Audit the current NMT Academy architecture against `ARCHITECTURE.md` and live code.

Focus:
1. App Router boundaries (`src/app`, `src/server`, `src/lib`, `src/components`)
2. Auth/session/guards and role hierarchy
3. Prisma data ownership (`userId`) on private records
4. Content import DRAFT vs publish gates
5. Risks to working SQLite and secrets

Deliver: findings with file paths, severity, and minimal recommended fixes. Do not rewrite the app.
