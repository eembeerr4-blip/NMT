---
description: Performance review for learning flows
---
Identify concrete performance risks in the described flow (dashboard, lesson, test runner, admin).

Look for:
- Unnecessary client bundle weight
- Repeated server work in layouts (`syncPlan`, etc.)
- N+1 Prisma patterns
- Heavy KaTeX/recharts usage on first paint
- Missing pagination on history/mistakes lists

Propose measured, minimal changes. No premature memoization unless justified.
