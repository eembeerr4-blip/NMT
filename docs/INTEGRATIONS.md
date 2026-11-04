# Integrations

Parallel browser agent activates Student Pack / OAuth. This document lists **project-side** wiring.

## GitHub Copilot

- Workspace instructions: `.github/copilot-instructions.md`
- Prompt files: `.github/prompts/*.prompt.md`
- VS Code: `.vscode/settings.json`, `.vscode/extensions.json`
- **Owner action:** install Copilot extensions and ensure an eligible GitHub account (Student Pack / Copilot license).

## Codecov

- Config: `codecov.yml`
- CI upload: `.github/workflows/ci.yml` (`codecov/codecov-action@v5`)
- Coverage command: `npm run test:coverage` → `coverage/lcov.info`
- **Owner actions:**
  1. Install Codecov GitHub App on `eembeerr4-blip/NMT` (if not finished).
  2. Add repository secret `CODECOV_TOKEN` (upload token) **or** rely on App OIDC once enabled.
  3. Open a PR to confirm the PR coverage comment appears.

Until then status is **CONFIGURED**, not PASS.

## Sentry

- SDK: `@sentry/nextjs`
- Config: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`, `src/app/global-error.tsx`
- Next wrapper: `next.config.ts` (`withSentryConfig`, source maps disabled unless `SENTRY_AUTH_TOKEN` + org/project set)
- Env names (see `.env.example`): `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- PII scrubbing: `src/lib/monitoring/sentry.ts`
- **Owner actions:** confirm Student offer or Trial org → create Next.js project → paste DSN into Vercel/GitHub secrets (never commit).

Safe test after DSN is set: temporarily hit a deliberate server error in a disposable environment and confirm the event in Sentry Issues. Without DSN, helpers still unit-test scrubbing.

## Vercel

- Existing GitHub ↔ Vercel project should remain the only project.
- Build command stays `npm run build` (includes safe Prisma generate).
- Add Sentry/Codecov-related env only in Vercel dashboards.
- **Do not** production-deploy from this infrastructure task.

## 1Password / secrets

Prefer:

1. Local `.env` (gitignored) for developer machines  
2. GitHub Actions secrets for CI  
3. Vercel Environment Variables for preview/production  
4. 1Password CLI / Environments for team sync of names (not values in git)

Never store real secrets in `.devcontainer`, workflows, or docs.

## Student Pack tooling map (integration intent)

| Tool | Use in NMT Academy | Action |
|---|---|---|
| Copilot | IDE assistance | Account + extensions |
| Codecov | PR coverage | App + token |
| Sentry | Error monitoring | DSN |
| GitHub Advanced Security / CodeQL | Workflow already added | Enable Code scanning in repo Settings if required by plan |
| Dependabot | Already configured | Keep enabled |
| Codespaces | `.devcontainer` | Create codespace from branch |
| Namecheap / domains etc. | Out of app scope | Browser agent |
| DigitalOcean / Azure credits | Hosting optional | Not wired; Vercel remains primary |
| BrowserStack / testing SaaS | Optional E2E expansion | Only if Playwright cloud needed later |

Do not add duplicate analytics/error SDKs without removing overlap with Sentry.
