---
description: 'NMT: prisma'
---

Read [project instructions](../copilot-instructions.md) and applicable AGENTS.md first.

Inspect schema.prisma and affected queries. Confirm the target database path without printing secrets. Preserve SQLite compatibility, transactions and userId/role constraints. Never migrate, seed, push or reset the working database. Validate proposed schema/query changes only against a disposable fixture; explain migration implications before changes.
