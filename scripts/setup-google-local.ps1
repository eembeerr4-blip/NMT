# Local-only Google OAuth setup. Enter values in this console, never in AI chat.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envPath = Join-Path $repo '.env.local'
if (-not (Test-Path -LiteralPath (Join-Path $repo 'src/server/google-oauth.ts'))) {
  throw 'NMT Academy project not found.'
}
if (-not (Test-Path -LiteralPath $envPath)) {
  throw '.env.local is missing. Existing Resend settings must be preserved.'
}
$original = [IO.File]::ReadAllText($envPath, [Text.Encoding]::UTF8)
$originalWriteTime = (Get-Item -LiteralPath $envPath).LastWriteTimeUtc
if ($original -notmatch '(?m)^AUTH_BASE_URL=http://localhost:3000\s*$') {
  throw 'AUTH_BASE_URL must be http://localhost:3000 for this local OAuth client.'
}
foreach ($name in @('RESEND_API_KEY', 'AUTH_EMAIL_FROM')) {
  if ($original -notmatch ('(?m)^' + $name + '=.+$')) {
    throw 'Existing Resend settings are missing; no changes made.'
  }
}
Write-Host 'Create a Google OAuth Web application client first.'
Write-Host 'Origin: http://localhost:3000'
Write-Host 'Redirect: http://localhost:3000/api/auth/google/callback'
$clientId = (Read-Host 'Paste Google client ID').Trim()
$secureSecret = Read-Host 'Paste Google client secret (hidden)' -AsSecureString
$ptr = [IntPtr]::Zero
$clientSecret = $null
$tempPath = $null
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
  $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ($clientId -notmatch '^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$') {
    throw 'Client ID format is invalid; no changes made.'
  }
  if ($clientSecret -notmatch '^[A-Za-z0-9_-]{8,}$') {
    throw 'Client secret format is invalid; no changes made.'
  }
  $updated = $original
  foreach ($name in @('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')) {
    $pattern = '(?m)^[ \t]*(?:export[ \t]+)?' + [Regex]::Escape($name) + '[ \t]*=.*(?:\r?\n|$)'
    $updated = [Regex]::Replace($updated, $pattern, '')
  }
  if ($updated.Length -gt 0 -and -not $updated.EndsWith("`n")) { $updated += "`r`n" }
  $updated += "GOOGLE_CLIENT_ID=$clientId`r`n"
  $updated += "GOOGLE_CLIENT_SECRET=$clientSecret`r`n"
  $tempPath = Join-Path $repo ('.env.local.' + [Guid]::NewGuid().ToString('N') + '.tmp')
  [IO.File]::WriteAllText($tempPath, $updated, [Text.UTF8Encoding]::new($false))
  if ((Get-Item -LiteralPath $envPath).LastWriteTimeUtc -ne $originalWriteTime) {
    throw '.env.local changed during input; no changes made.'
  }
  Move-Item -LiteralPath $tempPath -Destination $envPath -Force
  $tempPath = $null
  Write-Host 'Google OAuth settings saved locally. Existing Resend settings preserved.'
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($tempPath -and (Test-Path -LiteralPath $tempPath)) { Remove-Item -LiteralPath $tempPath -Force }
  $clientSecret = $null
  $secureSecret = $null
}
