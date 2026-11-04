# Monitoring

## Sentry

Env-gated. Without DSN, the app runs normally and does not open network calls to Sentry.

### After credentials exist

1. Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` (can be the same project DSN).
2. Set `SENTRY_ENVIRONMENT` (`development` / `preview` / `production`).
3. For source maps on Vercel/CI: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
4. Deploy/restart.
5. Trigger a controlled error in a disposable environment.
6. Confirm the issue in Sentry; verify request cookies/Authorization are filtered.

### What we deliberately do not send

- Passwords / password hashes  
- Session cookies  
- Authorization headers  
- Database URLs / API keys listed in `SENTRY_DENYLIST`

## Codecov

Coverage artifacts from `npm run test:coverage`. CI uploads `coverage/lcov.info`. PR comments appear after the Codecov App/token is connected.

Thresholds in `codecov.yml` use `target: auto` for project and informational patch goals so early baselines do not falsely block development.

## Logs

Next request logging ignores sensitive auth callback/verify routes (`next.config.ts`). Prefer Sentry for exception aggregation; do not duplicate PII into ad-hoc log drains.
