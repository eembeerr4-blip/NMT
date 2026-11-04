---
description: Review API routes and server actions
---
Review API routes and `src/server` actions related to the task.

Verify:
- Session validity (not only cookie presence / `src/proxy.ts`)
- Role gates (`canEditContent`, admin/owner helpers)
- Input validation (Zod)
- Error messages do not leak internals
- No unscoped Prisma updates
- Rate limits / trusted proxy assumptions documented when relevant
