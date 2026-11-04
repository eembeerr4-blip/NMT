# Security

## Non-negotiables

- Working SQLite (`prisma/dev.db` + WAL/SHM) is owner data. No reset/migrate/seed/upgrade without explicit permission.
- Never commit `.env`, tokens, OAuth secrets, password hashes, or full owner backups.
- Server authorization is mandatory; UI hiding is not enough.
- Content imports stay DRAFT until deliberate publish.

## GitHub security features

Configured in-repo:

- Dependabot: `.github/dependabot.yml`
- CodeQL + dependency review + npm audit: `.github/workflows/security.yml`
- CodeQL paths: `.github/codeql/codeql-config.yml`

**Owner Settings (PENDING if not already on):**

1. Settings → Code security → enable Dependabot alerts / security updates  
2. Enable Code scanning (CodeQL) if the plan requires a UI toggle  
3. Secret scanning + push protection (GitHub Advanced Security / public repo defaults)  
4. Restrict Actions secrets; never paste production DB paths into Actions logs  

These Settings clicks cannot be completed from the worktree alone.

## Secrets architecture

| Store | Use |
|---|---|
| Local `.env` | Developer machine only |
| GitHub Actions secrets | `CODECOV_TOKEN`, `SENTRY_AUTH_TOKEN`, etc. |
| Vercel env | Runtime DSN, OAuth, email |
| 1Password | Human vault / CLI sync of names |

Naming convention for new secrets: service prefix (`SENTRY_`, `CODECOV_`, `GOOGLE_`, `AUTH_`). Document names in `.env.example` without values.

## Application notes

- Session cookies: HttpOnly, SameSite=Lax; secure defaults for HTTPS.
- Login throttles are in-memory unless a shared edge limiter is configured (`AUTH_TRUSTED_PROXY`).
- Sentry scrubbing removes auth headers/cookies before send.
- `src/proxy.ts` is a cookie presence filter — real auth is `src/server/session.ts`.
