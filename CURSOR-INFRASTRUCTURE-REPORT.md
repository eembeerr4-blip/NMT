# CURSOR INFRASTRUCTURE REPORT — Mission 2

Дата: 2026-11-04  
Worktree: `D:\Вайб-кодинг\nmt-infra-tooling`  
Гілка: `infra/cursor-local-tooling-20261104`  
HEAD: `8a66d6976786d558fc23ff7481f6c206c00e65fb`  
Remote: `https://github.com/eembeerr4-blip/NMT`  
PR (do not merge): https://github.com/eembeerr4-blip/NMT/pull/8  
Base branch note: repo `default_branch` = `codex/github-publication`; PR opened to `main` as requested.

**Merge / production deploy не виконувались.**

---

## Підсумок інтеграцій (Mission 2)

| Інструмент | Статус | Доказ |
|---|---|---|
| Codecov | **PASS** | CI upload queued; visitor report shows **50.75%** on `a7954d5` — https://app.codecov.io/github/eembeerr4-blip/nmt/commit/a7954d58115273841523008e735adfa1649ee6bc |
| GitHub Actions CI | **PASS** | Push runs `41833696057` і `41840033034` → success (lint/typecheck/unit/coverage/build) |
| CodeQL | **PASS** | Security workflow on PR #8 → CodeQL success |
| Dependency review | **PASS** | Security workflow on PR #8 → success |
| Dependabot | **PASS** | `dependabot.yml` active; security updates **enabled**; 7 open alerts; Dependabot PRs #3–#6 |
| Secret Scanning | **PASS** | `secret_scanning` + `secret_scanning_push_protection` **enabled** |
| Vercel | **PASS** (link) / Preview **SKIPPED** | Project `taply12/nmt-academy` on PR checks; Preview **Canceled by Ignored Build Step** (production not touched) |
| Sentry | **CONFIGURED** | SDK wired; **no DSN** in env/secrets → live error test not sent (no fake PASS) |
| Copilot (GitHub) | **PENDING** | Instructions/prompts present; Cursor marketplace has no `GitHub.copilot`; VS Code has built-in Copilot Chat — Student/eligibility not verified in-editor here |
| Codespaces | **CONFIGURED** + cloud **SKIPPED** | `.devcontainer/devcontainer.json` valid (Node 22, `npm ci`, disposable `codespaces-dev.db`); cloud create skipped (no `codespace` gh scope / avoid paid credits without consent) |
| 1Password | **PENDING** | App/CLI not installed; Student Pack offer not confirmed in this agent |
| Playwright E2E | **FAIL** (local + GitHub) | Local: **11 passed / 23 failed / 1 did not run** (9.3m). GitHub PR run https://github.com/eembeerr4-blip/NMT/actions/runs/41841182993 → **failure**. Root cause: owner login lands on `/admin` («Огляд»), tests still expect heading `/Привіт/` |
| Branch protection / rulesets | **PENDING** | `main` not protected; rulesets `[]` — not enabled without owner policy |
| npm audit (CI job) | **PASS** (job) | Job succeeded with `continue-on-error`; **not** claimed as clean audit — see vulnerabilities below |

---

## Що реально запрацювало

1. **Codecov** — tokenless upload from public repo CI (`Token length: 0`); real commit coverage **50.75%** visible as visitor.  
2. **GitHub Actions CI** on infra branch — full quality job green twice.  
3. **Security workflow** on PR — CodeQL + dependency-review + npm-audit job green.  
4. **Dependabot + Secret Scanning + Push Protection** — confirmed enabled via API.  
5. **Vercel GitHub integration** — correct project `taply12/nmt-academy`; ignore-build prevented unintended preview/prod side effects.  
6. **PR #8** opened for review (not merged).

---

## Виправлення в Mission 2

| Зміна | SHA / файл |
|---|---|
| Infra scaffolding commit (Mission 1 push) | `a7954d5` |
| Isolate Stage5B / Stage82 Playwright specs that throw at import without dedicated QA DBs | `a4e4781` → `playwright.config.ts` |

---

## Codecov деталі

- `codecov.yml` present; CI step `codecov/codecov-action@v5` with `fail_ci_if_error: false`.  
- Upload log: found `coverage/lcov.info`, queued processing, report URL returned.  
- **No `CODECOV_TOKEN` secret** in repo (list empty) — public tokenless upload worked.  
- Owner optional: install Codecov GitHub App for richer PR comments/checks (dashboard still shows coverage without it).  
- Warning on report: **Missing Base Commit** (no coverage baseline on `main` yet).

---

## Sentry деталі

- Client / server / edge configs + `instrumentation.ts` + `global-error.tsx` + PII scrub helper — present.  
- Build succeeds with empty DSN.  
- Repo secrets: **none** (`gh secret list` empty) → cannot send test event.  
- **Do not** treat 14-day Trial as Student Pack confirmation.  
- Owner action: paste `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` (and optional `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` for source maps) into GitHub Actions secrets and Vercel env for the **existing** project only.

---

## GitHub Actions / Security

| Run | Event | Result |
|---|---|---|
| https://github.com/eembeerr4-blip/NMT/actions/runs/41833696057 | push `a7954d5` | CI **success** |
| https://github.com/eembeerr4-blip/NMT/actions/runs/41840033034 | push `a4e4781` | CI **success** |
| https://github.com/eembeerr4-blip/NMT/actions/runs/41840085102 | PR #8 Security | **success** (CodeQL, dependency-review, npm audit job) |
| https://github.com/eembeerr4-blip/NMT/actions/runs/41840085176 | PR #8 CI | **success** |
| https://github.com/eembeerr4-blip/NMT/actions/runs/41840085186 | PR #8 E2E | **cancelled** (superseded) |
| https://github.com/eembeerr4-blip/NMT/actions/runs/41841182993 | PR #8 E2E (latest) | **failure** (same admin/greeting drift as local) |

Enabled: Dependabot security updates, Secret scanning, Push protection.  
Not enabled / empty: branch protection on `main`, rulesets, secret validity checks, non-provider secret patterns.  
Code scanning alerts open count after CodeQL: **0**.

### Documented vulnerabilities (Dependabot alerts — not “audit PASS”)

| # | Severity | Summary |
|---|---|---|
| 1 | high | DeepmergeTS stack exhaustion (via Prisma config chain) |
| 2–3 | medium | Vitest mocker path traversal |
| 4–5 | critical | Tinypool prototype pollution / RCE gadgets |
| 6 | medium | Vitest unauthenticated mock registration |
| 7 | medium | minimatch ReDoS / amplification |

Local `npm audit --omit=dev --audit-level=high` also reports related trees (Prisma/deepmerge-ts; Sentry/glob/minimatch). Fixes via `npm audit fix --force` risk breaking upgrades — **not applied**.

---

## Stage 8 unit tests (excluded from `test:ci`)

Re-run on disposable QA SQLite (not working `dev.db`):

| Test | Result | Explanation |
|---|---|---|
| `tests/stage8-published-updater.test.ts` | **FAIL** (suite) | Frozen plan digest mismatch (`Reviewed plan digest mismatch` in `scripts/stage8-fix-published-questions.mjs`) — content lock / academic integrity, not infra |
| `tests/stage8-content.db.test.ts` | **1 failed / 24 passed** | Expected distractor Д `numericValue: 25` vs package now `24` with updated rationale — **academic content drift**; do not “fix” without owner content decision |

Both remain excluded from CI on purpose.

---

## Playwright E2E

**Config fix:** default suite ignores `e2e/stage5/stage5b-retry.spec.ts` and `e2e/stage82/**` (import-time gates requiring dedicated QA DBs). Not a silent skip of product bugs — those specs refuse to run outside their worktrees.

**Local `npm run test:e2e` (after fix):** 11 passed, 23 failed, 1 did not run.  
Dominant failure: after owner login, app shows admin **«Огляд»** (`/admin`); specs assert learning greeting `/Привіт/`. Error context confirms successful auth into admin shell — **product/test expectation drift**, not missing Chromium. Business UI not changed in this mission.

Gated specs (separate): Stage5B needs `prisma/stage5b-qa.db` + matching `DATABASE_URL`; Stage82 needs `STAGE82_BALANCED_LOCATION` fixture under OS temp.

---

## Copilot / VS Code / Cursor

- `.github/copilot-instructions.md` + 8 `.github/prompts/*.prompt.md` + `.vscode/*` present.  
- `cursor --install-extension GitHub.copilot` → **not found** in Cursor marketplace (do not confuse with Cursor Agent).  
- VS Code: Copilot Chat reported as built-in `0.72.0`; full Copilot completion/Student status **not proven** in this session.  
- Status: **PENDING** for “really works in editor”.

---

## Codespaces

- `devcontainer.json`: Node 22 image, `npm ci` + `prisma generate`, port 3000, Copilot/ESLint/Prisma/Playwright extensions, `DATABASE_URL=file:./codespaces-dev.db`.  
- JSON parse **OK**.  
- Cloud Codespace **not created** (gh codespace API needs extra scope; avoid paid quota without consent).

---

## Vercel

- Linked GitHub checks show **`taply12/nmt-academy`**.  
- PR Preview: **Canceled by Ignored Build Step** — safe relative to production.  
- No second project created; no production deploy.  
- Sentry can be attached later via Vercel env vars on this same project.

---

## 1Password

- No 1Password app/CLI on machine.  
- Integration remains documentation-only until Student Pack offer is activated by owner/parallel agent.  
- Status: **PENDING**.

---

## Credentials still missing

- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` (+ optional source-map trio)  
- Optional `CODECOV_TOKEN` / Codecov GitHub App (upload already works tokenless)  
- Copilot Student-eligible sign-in in VS Code  
- 1Password Student activation  

**Never committed:** `.env`, tokens, working SQLite.

---

## Owner actions remaining

1. Review PR #8 — **do not merge** until content+infra scope accepted (branch is many commits ahead of `main`).  
2. Add Sentry DSN to GitHub secrets + Vercel (`taply12/nmt-academy`).  
3. Optional: Codecov GitHub App for PR annotations.  
4. Decide branch protection / rulesets for `main` or `codex/github-publication`.  
5. Confirm Copilot in VS Code with Student account (not Cursor AI).  
6. Decide whether to approve E2E expectation update (owner → `/admin` vs `/Привіт`).  
7. Academic decision on Stage8 digest/distractor failures before re-including those tests.  
8. Consent before creating a cloud Codespace or spending paid credits.

---

## Paid / trial notes

- Sentry Trial previously opened elsewhere — **not** counted as Student Pack PASS.  
- Codecov tokenless on public repo — no paid plan required for current proof.  
- Codespaces cloud launch deferred to avoid unexpected billing.  
- Dependabot critical Tinypool/Vitest alerts may need coordinated dependency upgrades (possible paid/time cost), not force-bumped here.

---

## Змінені файли (Mission 1+2 on this branch tip)

Infra commits on top of prior Stage8 tip:

- `.devcontainer/devcontainer.json`
- `.env.example`
- `.github/**` (workflows, dependabot, codeql, copilot, prompts, PR template)
- `.vscode/**`
- `codecov.yml`
- `docs/INFRASTRUCTURE.md`, `INTEGRATIONS.md`, `DEVELOPER-SETUP.md`, `SECURITY.md`, `CI-CD.md`, `MONITORING.md`
- `CURSOR-INFRASTRUCTURE-REPORT.md`
- `next.config.ts`, `package.json`, `package-lock.json`, `vitest.config.ts`
- `playwright.config.ts` (Mission 2)
- `scripts/ci/*`
- `sentry.*.config.ts`, `src/instrumentation.ts`, `src/app/global-error.tsx`, `src/lib/monitoring/sentry*`
- `src/server/audit-actions.test.ts`

Academic packages / working SQLite / `.env` / math-sprint / station55/59 — **untouched**.

---

## Локальні перевірки (факти)

| Check | Result |
|---|---|
| `npm run test:ci` (Mission 1) | PASS — 1048 passed / 9 skipped |
| Coverage lcov | PASS — uploaded; Codecov **50.75%** on `a7954d5` |
| lint / typecheck / prisma validate / content JSON / build | PASS in GH CI |
| Stage8 excluded pair (disposable DB) | FAIL as academic locks (see above) |
| Playwright default suite | FAIL 23 (login/admin greeting drift) |
| Security settings API | Secret scanning + push protection + Dependabot updates enabled |

---

## Verdict legend

- **PASS** — live proof observed this mission  
- **CONFIGURED** — wiring ready; external credential/UI proof incomplete  
- **PENDING** — blocked on owner/parallel-agent credential or policy  
- **FAIL** — executed and failed with documented cause  
- **SKIPPED** — intentionally not run (billing/scope/safety)
