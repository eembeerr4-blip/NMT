---
description: Safe Prisma/SQLite change guidance
---
Plan a database-related change safely.

Required plan:
1. Exact models/fields touched
2. Migration strategy (or why none)
3. Disposable QA DB verification steps
4. Explicit statement that working `prisma/dev.db` will NOT be migrated without owner approval
5. Rollback notes
6. Tests that prove behavior on temp SQLite

Refuse destructive operations on the working database.
