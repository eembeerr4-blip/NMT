# One-time local OWNER password reset. Does not print the password.
# Requires: Node.js, project dependencies, owner approval for prisma/dev.db.
param(
  [string]$DatabaseUrl = "",
  [string]$UserId = "owner",
  [switch]$BackupConfirmed
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
if (-not $DatabaseUrl) {
  $DatabaseUrl = "file:" + ($repo.Replace("\", "/") + "/prisma/dev.db")
}

Write-Host "NMT Academy — local password reset"
Write-Host "Database: $DatabaseUrl"
Write-Host "User id:  $UserId"
Write-Host ""
Write-Host "Before changing prisma/dev.db:"
Write-Host "  1. Stop next start / next dev using this database."
Write-Host "  2. Run: node scripts/sqlite-online-backup.mjs --source <absolute dev.db> --dest <backup path>"
Write-Host "  3. Confirm you approve this one-time reset."
Write-Host ""

if ($DatabaseUrl -match "prisma/dev\.db") {
  if (-not $BackupConfirmed) {
    $confirm = Read-Host "Type YES to acknowledge backup and owner approval for the working database"
    if ($confirm -ne "YES") {
      Write-Host "Aborted."
      exit 1
    }
  } else {
    Write-Host "BackupConfirmed: skipping YES prompt (backup must already exist)."
  }
  $ack = "--ack-local-reset"
} else {
  $ack = ""
}

$pw1 = Read-Host "New password" -AsSecureString
$pw2 = Read-Host "Confirm password" -AsSecureString
$bstr1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw1)
$bstr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw2)
try {
  $plain1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr1)
  $plain2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr2)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)
}

if ($plain1 -ne $plain2) {
  Write-Host "Passwords do not match."
  exit 1
}
if ($plain1.Length -lt 8) {
  Write-Host "Password must be at least 8 characters."
  exit 1
}

Push-Location $repo
try {
  $plain1 | node scripts/set-user-password-local.mjs --database $DatabaseUrl --user-id $UserId $ack
} finally {
  Pop-Location
  $plain1 = $null
  $plain2 = $null
}
