# CI / CD

## Workflows

| Workflow | File | Triggers | Jobs |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | push/PR | lint, typecheck, prisma validate, content JSON, vitest, coverage→Codecov, build |
| E2E | `.github/workflows/e2e.yml` | PR (path-filtered) / manual | Playwright Chromium |
| Security | `.github/workflows/security.yml` | PR/push/schedule | dependency-review, CodeQL, npm audit |

Permissions are least-privilege (`contents: read` on CI/E2E; security-events write only on Security).

## Disposable databases in CI

Jobs set `DATABASE_URL` to placeholder `file:./ci-*.db` paths. Vitest DB suites create their own temp directories. CI must never mount or download the owner working database.

## Vercel

- Keep the existing Vercel project linked to GitHub.
- Preview deployments: safe after secrets are set.
- Production deploy: **owner-triggered only** — not part of this infrastructure PR task.
- Build uses `npm run build` → `scripts/prisma-generate-safe.mjs` + `next build`.

## Branch protection (recommended, PENDING owner)

Suggested rules for `main`:

- Require CI workflow  
- Require CodeQL / dependency review on PR  
- Do **not** require unreachable external checks that block solo development  
- Allow admin bypass for the owner while Student Pack / Codecov App finish setup  
