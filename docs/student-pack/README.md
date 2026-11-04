# NMT Academy: Student Pack integration

Date: 2026-11-04. This is an implementation checkpoint, not a claim that the ecosystem is fully activated.

## Scope and safety

Infrastructure branch: `infra/student-pack-integration-20261104`.
Worktree: `D:/Вайб-кодинг/nmt-student-pack-integration`.
Base: `84c1ea922b509bfcff72417896455d23dc0e039f` from the main local checkout.
Remote: https://github.com/eembeerr4-blip/NMT ; its default branch is `codex/github-publication`.

All 39 registered worktrees were inventoried in the local-only, ignored `worktree-baseline.json`, including absent/prunable entries. Existing modifications remain in their original worktrees. This worktree contains no copied .env or production database. Tests use synthetic, disposable databases. No production deployment, merge, force push, paid subscription, card registration or production database operation is authorized by this checkpoint.

## Current evidence

| Requirement | Status | Evidence / remaining check |
| --- | --- | --- |
| Complete offer catalogue | CONFIGURED | 83 public catalogue entries saved in catalogue-status.json; account-specific eligibility and vendor activation remain PENDING |
| All eligible benefits activated | BLOCKED | No new benefit claimed as activated; browser page control fails before page access |
| Copilot in VS Code | CONFIGURED | VS Code 1.144.1 includes GitHub Copilot 0.72.0; instructions, nine prompts and workspace settings added; correct account eembeerr4-blip confirmed by extension log; editor completion still unverified; official CLI smoke test passed |
| Copilot plan, models, credits, cloud agent, review | CONFIGURED | Official authenticated CLI confirms Student, 200 AI credits and Fusion automatic model selection; smoke response used 0.3 credits. GitHub Pro, cloud coding agent and review remain unverified |
| Codecov | CONFIGURED | OIDC upload succeeded; public Codecov API reports commit 8a26e0d complete, 181 files and 51.46% coverage. Native App installation and PR comment remain unverified |
| Sentry | PENDING | No SDK added before educational entitlement is confirmed; no test event sent |
| 1Password | PENDING | Account/benefit not verified; no vault read, export or migration performed |
| Codespaces | CONFIGURED | Node 22 devcontainer, npm ci, Prisma generation, extensions and private forwarding prepared; cloud launch and allowance unverified |
| Actions | PASS | Commit 825632d: all six push/PR runs succeeded. PR CI 41837639382, E2E 41837639413, Security 41837639342; push CI 41837631860, E2E 41837631884, Security 41837631802 |
| Secret scanning / push protection | PASS | Both reported enabled by authenticated GitHub repository API |
| Dependabot alerts / security updates | PASS | Enabled and independently re-read through GitHub API |
| Vercel | CONFIGURED | Created separate Hobby project taply12/nmt-academy after confirming taply belongs to finance-tracker; verified Git link to eembeerr4-blip/NMT, Next.js, Node 24.x, npm ci/build; all automatic builds skipped, zero deployments |
| Preview | PENDING | Existing project, branch, storage and environment isolation must be checked before deploying |
| Documentation | CONFIGURED | This document, catalogue and baseline evidence |
| Existing working data | PASS | Changes isolated to new worktree; no production data/credentials copied or modified |
| Azure / Notion | SKIPPED | Explicit owner exclusion, including Azure youth offer and Notion template collection |

## Verification checkpoint

- Full Vitest/V8 run: PASS, 86 files passed, 3 explicitly skipped; 1111 tests passed and 9 skipped. Duration 183.86 seconds.
- Coverage: statements 58.8%, branches 50.89%, functions 50.99%, lines 63.2%. `coverage/lcov.info` is real local output and its upload is confirmed independently by the Codecov API below.
- TypeScript: PASS. ESLint: PASS with two existing unused-variable warnings.
- Content JSON: PASS, 73 files. Math validator: PASS, 10 topics, 120 questions, 160 computations, 303 formulas.
- Prisma schema validation: PASS. Production build with network access to Google Fonts: PASS. Restricted-network build failed on the font download.
- Dependency audit after fixes: PASS at high severity; 0 high, 0 critical, 19 moderate remain.
- All workflow, Dependabot and Codecov YAML files parse successfully; editor/devcontainer/Vercel JSON parses successfully.
- E2E: PASS, all 32 standard tests in one fresh isolated run (3.0 minutes), including registration/email confirmation/moderation, role/record isolation, learning/results, imports, backups and mobile/tablet navigation. Local run used `NMT_E2E_PORT=3037` because another worktree owned 3010; that server was not stopped. Historical stage-specific suites remain opt-in because they require separate worktrees/fixtures.
- Push Actions CI/E2E/Security: PASS. PR Security includes successful dependency review and CodeQL; PR E2E: PASS. PR CI now passes after a scoped timeout fix for a child-process/live-WAL backup test. Its assertions remain unchanged; targeted regression passed all 10 tests after the change.
- Codecov processed commits 8a26e0d and 825632d successfully: 181 files, 4543 reported lines, 2338 hits, 1737 misses and 468 partials; API coverage is 51.46%. This service metric differs from Vitest's local line percentage; neither is substituted for the other. Native PR feedback still requires verification.
- Live editor Copilot and external benefit activation remain unverified.

## Implementation files

- `.github/copilot-instructions.md` references project instructions and preserves moderation, server guards, ownership checks and database safety.
- `.github/prompts/` contains architecture, debug, tests, refactor, review, Prisma, Next.js, security and learning-module prompts.
- `.vscode/settings.json` enables inline suggestions and project instruction files, and selects workspace TypeScript. It does not bypass approvals or select a paid model.
- `.vscode/extensions.json` recommends the integrations actually relevant to this stack.
- `.devcontainer/devcontainer.json` prepares an independent cloud development environment with `codespaces.db`; dependency installation and client generation do not initialize a working database or copy secrets.
- `vitest.config.ts` generates text-summary, LCOV and JSON-summary coverage across application source, including untested files.
- `scripts/verify-content-json.mjs` parses every JSON under `prisma/content` and `content` without database access; mathematical correctness uses the existing math validator.
- `codecov.yml` sets baseline-relative project status and 70% patch status; these settings do not fabricate a coverage baseline.
- Dependency changes: Vitest and its coverage provider 4.1.11; deepmerge-ts override 8.0.0. Prisma remains 6.19.3 and schema/migrations are unchanged. These changes address confirmed advisory chains in Vitest/tinypool and Prisma's config dependency.
- `.gitattributes` preserves LF bytes for the SHA-256-protected reviewed correction plan. The digest check is unchanged, and the plan's JSON data is unchanged.
- Existing audit test doubles now match server ownership checks and assert no writes on unavailable records. The historical math comparison explicitly records the existing reviewed distractor/explanation change; all answer-key invariants and independent math checks remain.
- The mistake-retry fixture now uses a unique system temp directory. This resolves a Windows Prisma migration hang observed with an absolute Cyrillic fixture path. Both affected suites passed 53 tests after the change.
- Playwright preparation has a 10-minute setup budget and enables WAL only on its own freshly created e2e.db to reduce rollback-journal overhead during synthetic seeding. Generated coverage reports are excluded from ESLint.
- Standard E2E tests assert the actual OWNER/ADMIN `/admin` landing route, then open learning explicitly where the scenario requires it. Application login behavior is unchanged.
- Backup E2E verifies the actual version-6 payload and retry/external-practice arrays. The incomplete demo import explicitly tests rejection by publication readiness and continued student isolation; it is not published just to satisfy an old test expectation.
- `vercel.json` disables automatic deployment only for this infrastructure branch until existing Vercel settings are verified. Other branches keep their default behavior. This is not a preview deployment.
- Dedicated Vercel project `taply12/nmt-academy` is configured for Next.js, Node 24.x, `npm ci` and `npm run build`, and linked to the exact NMT GitHub repository. Project-level `commandForIgnoringBuildStep=exit 0` currently skips all automatic builds; deployment listing is empty. Its current production-branch setting is `main`, whereas GitHub's default is `codex/github-publication`; resolve the intended release branch before enabling any production build. No production exists.
- Draft PR [#7](https://github.com/eembeerr4-blip/NMT/pull/7) targets the exact application base branch `feature/block-02-real-fixes`; it contains only this infrastructure work, rather than the 39 application commits ahead of the default branch. No merge is performed.

## Installed editor tools

Installation confirmed by VS Code CLI:

| Extension | Version | Usage |
| --- | --- | --- |
| GitHub Pull Requests | 0.174.0 | Review changes and PRs from the GitHub view |
| ESLint | 3.0.34 | Diagnostics for the existing ESLint config |
| Prisma | 31.13.0 | Schema editing and validation |
| Vitest | 1.52.2 | Discover and run targeted tests in Testing |
| Playwright | 1.1.19 | Discover E2E scenarios; use only isolated fixtures |
| GitHub Copilot | 0.72.0, built in | Chat, inline suggestions and agents after account/entitlement verification |

Official Vercel CLI 65.11.0 is available via npm execution and successfully authenticated; no global CLI duplicate was installed.

The legacy Copilot installation attempt was rejected because it attempted to downgrade the built-in Chat extension. A working Copilot response is verified through the official CLI; an editor response remains unverified.

## Using the prepared configuration

Open this worktree in VS Code. Use `/architecture`, `/debug`, `/tests`, `/refactor`, `/review`, `/prisma`, `/nextjs`, `/security` or `/learning-module` in chat after prompt discovery and sign-in have been verified. Keep prompts scoped to relevant files and start a fresh conversation for unrelated work to reduce repeated context. Do not enable overage spending.

Authenticated official Copilot CLI 1.0.105 confirmed the active Student plan, 200 AI credits with 0% used before the probe, and Fusion automatic model selection. An isolated, tool-denied smoke prompt returned NMT_COPILOT_OK, changed zero files and consumed 0.3 credits; auto selection reported GPT-5.6 Luna. No paid overage was enabled. Manual model selection was unavailable on this Student plan. Repository instructions and AGENTS.md were discovered by the CLI. VS Code's Copilot extension log separately confirms login as eembeerr4-blip and successful model-metadata retrieval, but opening a minimal Ask prompt does not prove an editor response. GitHub Pro, cloud coding agent and code-review entitlement remain unverified; their allowances are not added together.

The devcontainer installs dependencies and generates the Prisma client. Before using its app, an empty, isolated development database still needs deliberate initialization with synthetic data; the configuration does not seed or migrate any existing database automatically. A real Codespaces smoke test and billing allowance check remain necessary. No cloud machine was started.

CI runs dependency installation, Prisma generation, lint, TypeScript, coverage, JSON validation, mathematical validation and build. Coverage is uploaded as an Actions artifact and then submitted to Codecov via OIDC. No CODECOV_TOKEN is required by this configuration. The Codecov GitHub App must still be verified for NMT-only access and PR feedback.

E2E uses the existing Playwright fixture/bootstrap and `prisma/e2e.db` in its own checkout. It never uses the main checkout's database. Security runs dependency review for PRs, npm audit at high severity, and CodeQL for JavaScript/TypeScript. Weekly Dependabot scheduling and scheduled Actions take effect only once their configurations exist on the repository default branch; no merge is performed here.

## Secrets and external connections

New repository secrets: none. New persistent credentials: none. New GitHub Apps: none newly installed by this run. Vercel's existing GitHub integration now links NMT to the new dedicated project. Official CLI linking generated a short-lived `VERCEL_OIDC_TOKEN` in ignored `.env.local`; its value is never printed or committed. `.vercel` and local worktree inventory are also ignored.

Pending Sentry setup would require project-specific DSN and source-map upload configuration, usually `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`, after entitlement and privacy settings are confirmed. These names are a plan, not configured secrets. No real student data may enter a test event, replay or attachment.

Preview must use an isolated database and synthetic identities; production email/OAuth credentials must not be reused. Existing SQLite persistence and upload storage must be checked against the actual hosting architecture before calling Vercel ready.

## Dashboards and official references

- [Official Pack catalogue](https://education.github.com/pack)
- [Repository](https://github.com/eembeerr4-blip/NMT)
- [Actions](https://github.com/eembeerr4-blip/NMT/actions)
- [Security](https://github.com/eembeerr4-blip/NMT/security)
- [GitHub Copilot settings](https://github.com/settings/copilot)
- [GitHub billing](https://github.com/settings/billing)
- [Codespaces](https://github.com/codespaces)
- [Processed Codecov commit report](https://app.codecov.io/github/eembeerr4-blip/nmt/commit/8a26e0d9785c5270a6f6dbd3fe3ebfa0b8c73638) — completion and totals verified through the public API
- [Sentry](https://sentry.io/) — organization/project URL not verified
- [1Password](https://my.1password.com/) — account region and URL not verified
- [Vercel NMT Academy](https://vercel.com/taply12/nmt-academy) — dedicated project configured; no deployment exists
- [Copilot billing and AI credits](https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing)
- [VS Code prompt files](https://code.visualstudio.com/docs/agent-customization/prompt-files)
- [Codecov Action / OIDC](https://github.com/codecov/codecov-action)
- [Vitest migration guidance](https://vitest.dev/guide/migration/)
- [Tinypool critical advisory](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)
- [DeepmergeTS advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)

## Cost and renewal

No paid subscription, overage, automatic payment or trial renewal was enabled. No cloud hours intentionally started. The catalogue does not prove a vendor's actual renewal price or this account's billing settings; those remain PENDING for each offer. Do not auto-upgrade when a student benefit expires. Check entitlement expiry, payment settings and current official vendor pricing before activation. A trial, student benefit and permanently free tier must be recorded separately.

## Remaining access blocker

Chrome inventory is connected, but the existing Pack tab fails before any page observation with an undefined timeout-options error. Resetting/reconnecting did not resolve it. Native app control is unavailable in this session (empty app inventory), so mouse authorization alone cannot provide control of VS Code or vendor account screens. This blocks account-specific Pack eligibility/redemption, Sentry educational verification, 1Password verification and Codecov App installation/PR feedback. No offer is marked activated from catalogue presence alone. Vercel Preview additionally needs a verified isolated persistence strategy for the existing SQLite/upload architecture; no production deployment or storage migration was performed.
