param([ValidateSet('Prepare','Start','Stop')][string]$Action)
$ErrorActionPreference='Stop'
$qaRoot='D:/Вайб-кодинг/nmt-beta'
$qaDatabase=Join-Path $qaRoot 'audit/tests/beta-fresh.db'
$qaState=Join-Path $qaRoot 'audit/reports/qa-fresh-process.json'
if($Action -eq 'Prepare') {
 if(Test-Path -LiteralPath $qaDatabase){throw 'Fresh QA database already exists; refusing to overwrite'}
 $null=New-Item -ItemType File -Path $qaDatabase
 $env:DATABASE_URL='file:D:/Вайб-кодинг/nmt-beta/audit/tests/beta-fresh.db'
 $qaSeed=(Get-Content -LiteralPath (Join-Path $qaRoot 'audit/tests/beta-prepare.ts') -Raw).Replace('beta-chrome.db','beta-fresh.db')
 $qaSeed | Set-Content -LiteralPath (Join-Path $qaRoot 'audit/tests/fresh-prepare.ts')
 node node_modules/prisma/build/index.js migrate deploy
 if($LASTEXITCODE -ne 0){throw 'Fresh QA deploy failed'}
 node node_modules/tsx/dist/cli.mjs audit/tests/fresh-prepare.ts
 if($LASTEXITCODE -ne 0){throw 'Fresh QA fixture failed'}
 exit 0
}
if($Action -eq 'Stop') {
 $saved=Get-Content -LiteralPath $qaState -Raw | ConvertFrom-Json
 $qaProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $($saved.pid)"
 if($null -eq $qaProcess){exit 0}
 if($qaProcess.CommandLine -notlike '*nmt-beta*next*' -or $qaProcess.CommandLine -notlike '*3101*'){throw 'QA process mismatch'}
 taskkill /PID $saved.pid /T /F
 exit $LASTEXITCODE
}
if(-not(Test-Path -LiteralPath $qaDatabase)){throw 'Prepare fresh QA first'}
$env:DATABASE_URL='file:D:/Вайб-кодинг/nmt-beta/audit/tests/beta-fresh.db'
$env:SESSION_COOKIE_SECURE='false';$env:NEXT_TELEMETRY_DISABLED='1'
$qaNext=Join-Path $qaRoot 'node_modules/next/dist/bin/next'
$qaProcess=Start-Process -FilePath (Get-Command node).Source -ArgumentList @($qaNext,'start','--hostname','127.0.0.1','--port','3101') -WorkingDirectory $qaRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $qaRoot 'audit/reports/fresh-server.log') -RedirectStandardError (Join-Path $qaRoot 'audit/reports/fresh-server-error.log') -PassThru
@{pid=$qaProcess.Id;url='http://127.0.0.1:3101';database='QA-only beta-fresh.db'} | ConvertTo-Json | Set-Content -LiteralPath $qaState
Write-Output "Fresh QA PID=$($qaProcess.Id), http://127.0.0.1:3101"
