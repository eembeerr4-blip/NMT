# Run in an interactive PowerShell window. The API key is never an argument or printed.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envPath = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'src/server/auth-mail.ts'))) {
  throw 'NMT Academy project was not found next to this script.'
}

$secureKey = Read-Host 'Paste the Resend API key (input hidden)' -AsSecureString
if ($secureKey.Length -eq 0) { throw 'No key entered; settings were not changed.' }
$ptr = [IntPtr]::Zero
$key = $null
$tempPath = $null
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ($key -notmatch '^re_[A-Za-z0-9_-]+$') {
    throw 'Key format is invalid; settings were not changed.'
  }

  $original = ''
  $originalWriteTime = $null
  if (Test-Path -LiteralPath $envPath) {
    $original = [IO.File]::ReadAllText($envPath, [Text.Encoding]::UTF8)
    $originalWriteTime = (Get-Item -LiteralPath $envPath).LastWriteTimeUtc
  }
  $updated = $original
  foreach ($name in @('AUTH_BASE_URL', 'AUTH_EMAIL_FROM', 'RESEND_API_KEY')) {
    $pattern = '(?m)^[ \t]*(?:export[ \t]+)?' + [Regex]::Escape($name) + '[ \t]*=.*(?:\r?\n|$)'
    $updated = [Regex]::Replace($updated, $pattern, '')
  }
  if ($updated.Length -gt 0 -and -not $updated.EndsWith("`n")) { $updated += "`r`n" }
  $updated += "AUTH_BASE_URL=http://localhost:3000`r`n"
  $updated += "AUTH_EMAIL_FROM=`"NMT Academy <onboarding@resend.dev>`"`r`n"
  $updated += "RESEND_API_KEY=$key`r`n"

  $tempPath = Join-Path $projectRoot ('.env.local.' + [Guid]::NewGuid().ToString('N') + '.tmp')
  [IO.File]::WriteAllText($tempPath, $updated, [Text.UTF8Encoding]::new($false))
  if ($null -ne $originalWriteTime) {
    if (-not (Test-Path -LiteralPath $envPath) -or (Get-Item -LiteralPath $envPath).LastWriteTimeUtc -ne $originalWriteTime) {
      throw '.env.local changed during input; settings were not changed.'
    }
  } elseif (Test-Path -LiteralPath $envPath) {
    throw '.env.local appeared during input; settings were not changed.'
  }
  Move-Item -LiteralPath $tempPath -Destination $envPath -Force
  $tempPath = $null
  Write-Host 'Resend settings saved locally. No secret was printed.'
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($tempPath -and (Test-Path -LiteralPath $tempPath)) { Remove-Item -LiteralPath $tempPath -Force }
  $key = $null
  $secureKey = $null
}