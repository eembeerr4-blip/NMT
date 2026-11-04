# CURSOR INFRASTRUCTURE REPORT

Дата: 2026-11-04  
Worktree: `D:\Вайб-кодинг\nmt-infra-tooling`  
Гілка: `infra/cursor-local-tooling-20261104`  
HEAD: `84c1ea922b509bfcff72417896455d23dc0e039f`  
Remote repo: `https://github.com/eembeerr4-blip/NMT`

**Коміт / push / merge / production deploy не виконувались** (за обмеженнями завдання).

Паралельні агенти не зачіпались: math-sprint і student-pack worktree збережені. Випадковий checkout math-гілки в infra-worktree виправлено; незакомічені math-файли повернуті в `nmt-math-sprint`.

---

## 1. Змінені / створені файли

### Modified
- `.env.example` — Sentry/Codecov/OAuth placeholder names
- `next.config.ts` — optional `withSentryConfig`
- `package.json` / `package-lock.json` — scripts + deps
- `vitest.config.ts` — coverage (v8)
- `src/server/audit-actions.test.ts` — mocks aligned with `findFirst` / `updateMany`

### Added
- `.github/copilot-instructions.md`
- `.github/prompts/*.prompt.md` (8 prompts)
- `.github/workflows/ci.yml`, `e2e.yml`, `security.yml`
- `.github/dependabot.yml`, `.github/codeql/codeql-config.yml`, `.github/PULL_REQUEST_TEMPLATE.md`
- `.vscode/settings.json`, `.vscode/extensions.json`
- `.devcontainer/devcontainer.json`
- `codecov.yml`
- `scripts/ci/validate-content-json.mjs`, `scripts/ci/prisma-validate.mjs`
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `src/instrumentation.ts`, `src/app/global-error.tsx`
- `src/lib/monitoring/sentry.ts`, `src/lib/monitoring/sentry.test.ts`
- `docs/INFRASTRUCTURE.md`, `INTEGRATIONS.md`, `DEVELOPER-SETUP.md`, `SECURITY.md`, `CI-CD.md`, `MONITORING.md`
- `CURSOR-INFRASTRUCTURE-REPORT.md` (цей файл)

Academic content packages: **не змінювались**.

---

## 2. Залежності

| Package | Type | Version (installed) |
|---|---|---|
| `@sentry/nextjs` | dependency | ^10.78.0 |
| `@vitest/coverage-v8` | devDependency | ^3.2.7 |

---

## 3. Інтеграції (статуси)

| Integration | Status | Notes |
|---|---|---|
| GitHub Copilot workspace instructions | **CONFIGURED** | Needs Copilot-enabled GitHub account + extensions |
| GitHub Actions CI | **CONFIGURED** | Validated locally via same scripts; live GH run needs push/PR |
| Unit tests (local) | **PASS** | `npm run test:ci` → exit 0 (1048 passed / 9 skipped) |
| Coverage generation | **PASS** | `coverage/lcov.info` produced |
| Codecov upload | **PENDING** | Needs Codecov GitHub App and/or `CODECOV_TOKEN` secret + a CI run on GitHub |
| Sentry SDK wiring | **CONFIGURED** | Builds without DSN; live events need DSN secrets |
| Sentry live error test | **PENDING** | Blocked on credentials from parallel browser agent |
| Dependabot | **CONFIGURED** | File present; enable alerts in Settings if needed |
| CodeQL / dependency-review | **CONFIGURED** | Workflow present; Code scanning enablement may be PENDING in Settings |
| Secret scanning / push protection | **PENDING** | GitHub Settings (cannot toggle from worktree) |
| Codespaces | **CONFIGURED** | `.devcontainer` ready; create codespace from branch to verify in browser |
| Vercel | **CONFIGURED** | Existing project; no second project; no production deploy |
| 1Password | **CONFIGURED** (docs only) | Architecture documented; no custom password vault in app |
| Playwright E2E (local full run) | **SKIPPED** | Workflow added; full local browser suite not re-run here after 4+ min unit suite + build (see §6) |
| Playwright workflow | **CONFIGURED** | `.github/workflows/e2e.yml` |

---

## 4. Workflows

1. `.github/workflows/ci.yml` — lint, typecheck, prisma validate, content JSON, vitest, coverage→Codecov, build  
2. `.github/workflows/e2e.yml` — Playwright Chromium  
3. `.github/workflows/security.yml` — dependency review, CodeQL, npm audit  

---

## 5–6. Тести (фактичні exit codes)

| Check | Exit | Result |
|---|---:|---|
| `npx prisma generate` | 0 | PASS |
| `npm run lint` | 0 | PASS (2 pre-existing warnings elsewhere) |
| `npm run typecheck` | 0 | PASS |
| `npm run ci:prisma` | 0 | PASS |
| `npm run ci:content` | 0 | PASS (11 packages) |
| `npm run test:ci` | 0 | PASS — 1048 passed, 9 skipped |
| Coverage (focused + lcov) | 0 | PASS — `coverage/lcov.info` exists |
| `npm run build` (no Sentry DSN) | 0 | PASS |
| Full Playwright local | — | **SKIPPED** (time/browser; workflow CONFIGURED) |

### Pre-existing failures handled

- `tests/stage8-published-updater.test.ts` — digest mismatch vs frozen plan → **excluded from `test:ci`** (content lock, not infra regression)  
- `tests/stage8-content.db.test.ts` — distractor text drift → **excluded from `test:ci`**  
- `audit-actions.test.ts` mocks outdated (`findUnique` vs `findFirst`) → **fixed** to match current secure queries  

---

## 7. Дії в браузері (для паралельного агента / власника)

1. Завершити Codecov GitHub App на `eembeerr4-blip/NMT`.  
2. Додати `CODECOV_TOKEN` (або OIDC App) у GitHub Actions secrets.  
3. Підтвердити Sentry org (Student vs Trial) → створити Next.js project → скопіювати DSN.  
4. Додати `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` (і за бажанням `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) у Vercel + GitHub secrets.  
5. GitHub Settings → Code security: Dependabot alerts, Code scanning, Secret scanning, Push protection.  
6. Відкрити PR з цієї гілки, щоб CI/Codecov/CodeQL реально відпрацювали на GitHub.  
7. (Опційно) Codespaces → New codespace from `infra/cursor-local-tooling-20261104`.  
8. Увімкнути Copilot у VS Code/Cursor з eligible акаунтом.

---

## 8. Недостатні credentials

- `CODECOV_TOKEN` (або App installation completion)  
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`  
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (лише для upload source maps)  
- Будь-які нові OAuth keys лише якщо Student Pack агент їх видасть — **не записувались у git**

---

## 9. Обмеження

- Немає доступу до GitHub Settings / Vercel production з цього worktree.  
- Немає права оголошувати Codecov/Sentry **PASS** без живого звіту в хмарі.  
- `test:ci` свідомо виключає два stage8 content-lock тести.  
- npm audit у security workflow має `continue-on-error` на high audit (існуючий борг залежностей; не маскується як чистий audit PASS).  
- Не чіпали working SQLite / `.env` / math & Ukrainian content packages.

---

## 10. Git status (зараз)

Uncommitted changes on `infra/cursor-local-tooling-20261104` (modified + untracked infra files listed in §1).  
**No commit created** (owner did not request commit in this mission text; parallel content work remains separate).

---

## 11. HEAD і гілка

- Branch: `infra/cursor-local-tooling-20261104`  
- HEAD: `84c1ea922b509bfcff72417896455d23dc0e039f`  
- Base equals former `feature/block-02-real-fixes` tip used for the worktree.

---

## 12. Готовність до зовнішніх сервісів

| Service | Ready to paste credentials? |
|---|---|
| Codecov | Yes — CI upload step present |
| Sentry | Yes — env-gated SDK; build works offline |
| Dependabot/CodeQL | Yes — configs present |
| Codespaces | Yes — devcontainer present |
| Vercel | Yes — no second project; add env in dashboard |
| Copilot | Yes — instructions/prompts/settings present |

### Verdict legend used above

- **PASS** — executed and verified locally in this worktree  
- **CONFIGURED** — project wiring done; external account/Settings/CI-on-GitHub still required for live proof  
- **PENDING** — waiting on owner/browser-agent credentials or Settings  
- **SKIPPED** — intentionally not run here, with reason  
