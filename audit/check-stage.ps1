param([Parameter(Mandatory=$true)][ValidatePattern('^\d{2}[A-H]?$')][string]$Stage)
$ErrorActionPreference='Stop'
if ((Get-Location).Path -ne 'D:\Вайб-кодинг\nmt-beta') { throw 'QA worktree required' }
$env:DATABASE_URL='file:D:/Вайб-кодинг/nmt-beta/audit/tests/beta-chrome.db'
$env:NMT_AUDIT_DB='0';$env:SESSION_COOKIE_SECURE='false';$env:NEXT_TELEMETRY_DISABLED='1';$env:NMT_BETA_STAGE=$Stage
function Check-Result([string]$name,[int]$code) { if ($code -ne 0) { Get-Content -LiteralPath "audit/reports/$Stage-$name.log" -Tail 45; throw "$name failed (exit $code)" }; Write-Output "$Stage $name PASS" }
npx tsc --noEmit --incremental false *> "audit/reports/$Stage-typecheck.log"
Check-Result 'typecheck' $LASTEXITCODE
npm run lint *> "audit/reports/$Stage-lint.log"
Check-Result 'lint' $LASTEXITCODE
npm test -- --maxWorkers=2 *> "audit/reports/$Stage-tests.log"
Check-Result 'tests' $LASTEXITCODE
# Windows Prisma DLL cannot be regenerated while a DB test or QA server owns it.
& ./audit/qa-server.ps1 Stop
npm run build *> "audit/reports/$Stage-build.log"
Check-Result 'build' $LASTEXITCODE
& ./audit/qa-server.ps1 Start
node node_modules/@playwright/test/cli.js test --config playwright.beta.config.ts --max-failures=1 *> "audit/reports/$Stage-playwright.log"
Check-Result 'playwright' $LASTEXITCODE
Get-Content -LiteralPath "audit/reports/$Stage-tests.log" -Tail 7
Get-Content -LiteralPath "audit/reports/$Stage-playwright.log" -Tail 3
