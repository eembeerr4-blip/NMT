param([ValidateSet('Start','Stop','Status')][string]$Action='Status')
$ErrorActionPreference='Stop'
$nmtRoot='D:/Вайб-кодинг/nmt-beta'
$nmtState=Join-Path $nmtRoot 'audit/reports/qa-process.json'
if ($Action -eq 'Stop' -or $Action -eq 'Status') {
  if (-not (Test-Path -LiteralPath $nmtState)) { Write-Output 'No recorded QA process'; exit 0 }
  $nmtSaved=Get-Content -LiteralPath $nmtState -Raw | ConvertFrom-Json
  $nmtProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $($nmtSaved.pid)"
  if ($null -eq $nmtProcess) { Write-Output 'Recorded QA process is stopped'; exit 0 }
  if ($nmtProcess.CommandLine -notlike '*nmt-beta*next*' -or $nmtProcess.CommandLine -notlike '*3100*') { throw 'QA process identity mismatch' }
  if ($Action -eq 'Stop') { taskkill /PID $nmtSaved.pid /T /F; if ($LASTEXITCODE -ne 0) { throw 'Could not stop QA process' } }
  else { Write-Output "QA PID=$($nmtSaved.pid), http://127.0.0.1:3100" }
  exit 0
}
$env:DATABASE_URL='file:D:/Вайб-кодинг/nmt-beta/audit/tests/beta-chrome.db'
$env:SESSION_COOKIE_SECURE='false'
$env:NEXT_TELEMETRY_DISABLED='1'
$nmtNext=Join-Path $nmtRoot 'node_modules/next/dist/bin/next'
$nmtProcess=Start-Process -FilePath (Get-Command node).Source -ArgumentList @($nmtNext,'start','--hostname','127.0.0.1','--port','3100') -WorkingDirectory $nmtRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $nmtRoot 'audit/reports/qa-server.log') -RedirectStandardError (Join-Path $nmtRoot 'audit/reports/qa-server-error.log') -PassThru
@{pid=$nmtProcess.Id;url='http://127.0.0.1:3100';database='QA-only beta-chrome.db'} | ConvertTo-Json | Set-Content -LiteralPath $nmtState
Write-Output "QA PID=$($nmtProcess.Id), http://127.0.0.1:3100"
