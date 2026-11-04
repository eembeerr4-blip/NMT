# Developer setup

## Prerequisites

- Node.js 22+
- npm (lockfile is `package-lock.json`)
- Git
- Optional: GitHub Copilot, 1Password CLI, Vercel CLI

## Clone / worktree

Prefer an isolated worktree for infrastructure or feature work so content agents are undisturbed:

```bash
git fetch origin
git worktree add ../nmt-infra-tooling -b infra/cursor-local-tooling-20261104 <base-sha>
cd ../nmt-infra-tooling
npm ci
npx prisma generate
```

## Environment

```bash
cp .env.example .env
# Edit locally. Never commit .env.
```

Minimum for local UI: `DATABASE_URL` pointing at a **non-production** SQLite file under `prisma/` for `next dev` experiments. Do **not** migrate the owner's working `prisma/dev.db` without approval.

## Everyday commands

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `test:ci` | Vitest |
| `npm run test:coverage` | Vitest + lcov |
| `npm run test:e2e` | Playwright (install browsers first) |
| `npm run build` | Production build |
| `npm run ci:prisma` | `prisma validate` on disposable URL |
| `npm run ci:content` | Content package JSON structural check |

## Codespaces

Open the repo in Codespaces; `.devcontainer/devcontainer.json` installs deps and generates Prisma client. Container sets `DATABASE_URL=file:./codespaces-dev.db` (disposable). Add secrets via Codespaces Secrets UI — never bake them into the JSON.

## Copilot

1. Install recommended extensions (`.vscode/extensions.json`).
2. Sign in to GitHub with Copilot entitlement.
3. Chat should load `.github/copilot-instructions.md` via workspace settings.
4. Use prompt files under `.github/prompts/` for structured tasks.
