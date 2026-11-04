## Summary

-

## Type

- [ ] Feature
- [ ] Fix
- [ ] Infrastructure / CI
- [ ] Content (REVIEW-ONLY)
- [ ] Docs

## Safety checklist

- [ ] No working `prisma/dev.db` migrate/reset/seed
- [ ] No secrets / `.env` / password hashes in the diff
- [ ] Server authZ preserved (role + ownership)
- [ ] DB tests use disposable SQLite
- [ ] Academic content packages not rewritten unless this PR is a content task

## Test plan

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:ci`
- [ ] Targeted E2E / browser check if UI path changed

## Notes for reviewers

-
