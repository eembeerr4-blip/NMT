# STAGE01 checkpoint manifest — historical snapshot, superseded

Base HEAD: `2169596c5b4ccb363ebf02d1692c4754a886575b`

These 13 files were the safe candidate subset of the 20 reviewed paths before the later auth QA task. This is not an approved checkpoint or commit. The corresponding archive was preserved as TASK-CHANGES-checkpoint-review-20261021.zip. The current TASK-CHANGES.zip belongs to the later auth QA task and is described in TASK-REPORT.md. The patch below is also a historical snapshot and must not be used to apply the current task.

| Status | Path | SHA-256 |
| --- | --- | --- |
| MODIFIED | `PLAN.md` | `8638efa5654e9d79900d84afe146121694b99b1ba336c31d23f12fee5c7ea6bc` |
| MODIFIED | `src/app/(main)/settings/page.tsx` | `6d5575bc4f34bcece1fc3b6a925e0c30d12aea8d9d31c236b19577376ce2b7ab` |
| MODIFIED | `src/app/forgot-password/page.tsx` | `d81bb3daabb0997e62ad6105a14dd015269e2e314e0b89355412b208d3b4d786` |
| MODIFIED | `src/app/login/page.tsx` | `a515efe81d4aa08a99471f8a5c5cfc79e088ee99e44cbf7aefef3396a5ac6f55` |
| MODIFIED | `src/app/register/page.tsx` | `f73c599fce3b2506a4653e7164d4ad868615bacab3d4a1e93ff006c5370f6b30` |
| MODIFIED | `src/server/auth-mail.ts` | `aba6aadd2d28c5fca947787ebb4d6ff5945a84fdf143da716d70784a4d9bd562` |
| MODIFIED | `src/server/auth-service.ts` | `3eece668548e82745e37ee4ba0eaadf500569dafaa971640717662091de4d3a7` |
| MODIFIED | `tests/account-auth.test.ts` | `dee888795109bb9ffb3908af00f256206a7ad48feb246776e15ed0cd6cbe76e7` |
| MODIFIED | `tests/google-flow.test.ts` | `7e1714bc261ba4750aa3daa15a5384cf29d3842b49998d2ca55e9af66f422562` |
| NEW | `tests/auth-mail.test.ts` | `59eb7a98de8e315117810b1393f22001d1bbda403cfafc45256bb6a18f31de9a` |
| NEW | `scripts/START-GOOGLE-SETUP.cmd` | `85d77c01e961af274a30099401247b30f167a5c0a48794e4cc79ae49e44cf161` |
| NEW | `scripts/setup-google-local.ps1` | `ef5be8e7c180ff514a5f2be5acf3e7104dad334c232f4ee9b5dfa1c5a933e317` |
| NEW | `scripts/setup-resend-local.ps1` | `841208b2aed94bbe775d5c005a49f03254f0b653ffd1eb9b03b6c6ec6185fb68` |

## Held back from the original 20-path proposal

The following seven paths were reviewed but are **not** in the proposed ZIP/patch/commit. The password reset scripts allow a relative SQLite URL to bypass the working-database guard; their associated test and owner setup document should not be checkpointed without a fix/review. The backup/snapshot/fingerprint scripts are local owner-recovery tools; the backup currently checkpoints the source and needs a separate safety decision.
- `docs/stage01-owner-setup.md`
- `tests/set-user-password-local.test.ts`
- `scripts/set-owner-password.ps1`
- `scripts/set-user-password-local.mjs`
- `scripts/sqlite-online-backup.mjs`
- `scripts/db-snapshot.mjs`
- `scripts/wait-password-fingerprint.mjs`
