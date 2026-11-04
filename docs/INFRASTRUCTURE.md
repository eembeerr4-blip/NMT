# Infrastructure overview

NMT Academy local + CI tooling (branch `infra/cursor-local-tooling-20261104`).

## What this repo now includes

| Area | Location | Status model |
|---|---|---|
| Copilot instructions | `.github/copilot-instructions.md`, `.github/prompts/*`, `.vscode/*` | CONFIGURED locally; Copilot license is account-side |
| CI | `.github/workflows/ci.yml` | CONFIGURED — runs after push/PR on GitHub |
| E2E | `.github/workflows/e2e.yml` | CONFIGURED |
| Security | `.github/workflows/security.yml`, Dependabot, CodeQL config | CONFIGURED — some GitHub Settings toggles PENDING |
| Coverage | `vitest` coverage + `codecov.yml` + CI upload | CONFIGURED — Codecov GitHub App / token PENDING for live reports |
| Sentry | `@sentry/nextjs` + env-gated init | CONFIGURED — DSN/auth token PENDING |
| Codespaces | `.devcontainer/devcontainer.json` | CONFIGURED |
| Secrets docs | `docs/SECURITY.md` | documentation |

## Non-goals

- No production deployment from this branch.
- No migrations against the owner working `prisma/dev.db`.
- No rewriting of academic content packages.
- No second Vercel project.

## Safe local commands

```bash
npm ci
npm run lint
npm run typecheck
npm run test:ci
npm run test:coverage
npm run ci:prisma
npm run ci:content
npm run build
```

Use a disposable `DATABASE_URL=file:./something-temp.db` for any migrate/seed experiments. Prefer the existing Vitest patterns that create temp DBs automatically.
