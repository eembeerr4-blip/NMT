# One protected local password entry; verify first, then run the guarded browser release once.
param([string]$ResultPath = "", [string]$AuthenticationResultPath = "", [string]$ReadinessFile = "", [switch]$PublishOnly, [string]$ResumeControlPath = "")
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$mainRoot = Join-Path (Split-Path -Parent $repoRoot) "NMT-academy"
$verificationScript = Join-Path $mainRoot "scripts/verify-owner-password-stdin.mjs"
$databasePath = Join-Path $mainRoot "prisma/dev.db"
$releaseScript = Join-Path $PSScriptRoot "stage7-production-browser-release.mts"
$tsx = Join-Path $repoRoot "node_modules/tsx/dist/cli.mjs"
$baseUrl = "http://127.0.0.1:3000"
if (-not [Environment]::UserInteractive) { throw "Run this file in a visible local PowerShell window." }
foreach ($file in @($verificationScript, $databasePath, $releaseScript, $tsx)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required local file is missing: $file" }
}
if ($ResultPath -and (Test-Path -LiteralPath $ResultPath)) { throw "Result file already exists; refused to overwrite it." }
$response = Invoke-WebRequest "$baseUrl/login" -TimeoutSec 15 -UseBasicParsing
if ($response.StatusCode -ne 200) { throw "Login page is unavailable." }
Write-Host "NMT Academy: Stage 7 OWNER verification and release"
Write-Host "One password entry. It will not be printed or saved."
if ($PublishOnly) { Write-Host "Publish-only continuation: the 120 VERIFIED questions will not be changed; publish the 10 approved topics." }
else { Write-Host "After a valid password: verify the 120 approved questions and publish the 10 approved topics." }
$mutex = New-Object System.Threading.Mutex($false, "Local\NMT-Stage7-Release")
if (-not $mutex.WaitOne(0)) { throw "Another local Stage 7 release is active." }
$secure = Read-Host "OWNER password" -AsSecureString
$bstr = [IntPtr]::Zero
$plain = $null
try {
    if ($secure.Length -eq 0) { throw "Empty password; no release started." }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $verifyInfo = New-Object System.Diagnostics.ProcessStartInfo
    $verifyInfo.FileName = (Get-Command node).Source
    $verifyInfo.Arguments = '"' + $verificationScript + '" "' + $databasePath + '"'
    $verifyInfo.UseShellExecute = $false
    $verifyInfo.CreateNoWindow = $true
    $verifyInfo.RedirectStandardInput = $true
    $verifyInfo.RedirectStandardOutput = $true
    $verifyInfo.RedirectStandardError = $true
    $verify = New-Object System.Diagnostics.Process
    $verify.StartInfo = $verifyInfo
    [void]$verify.Start()
    $passwordBytes = [Text.Encoding]::UTF8.GetBytes($plain)
    try { $verify.StandardInput.BaseStream.Write($passwordBytes, 0, $passwordBytes.Length); $verify.StandardInput.BaseStream.Flush() }
    finally { [Array]::Clear($passwordBytes, 0, $passwordBytes.Length); $passwordBytes = $null }
    $verify.StandardInput.Close()
    if (-not $verify.WaitForExit(15000)) { $verify.Kill(); throw "Local verification timed out; release not started." }
    $verified = $verify.StandardOutput.ReadToEnd().Trim()
    $verifyError = $verify.StandardError.ReadToEnd()
    $verifyCode = $verify.ExitCode
    $verify.Dispose()
    if ($verifyCode -eq 2) { throw "Read-only password verification failed; release not started." }
    $verification = $verified | ConvertFrom-Json
    Write-Host $verified
    if ($AuthenticationResultPath) {
        $authFile = [IO.File]::Open($AuthenticationResultPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
        try { $bytes = [Text.Encoding]::UTF8.GetBytes($verified); $authFile.Write($bytes, 0, $bytes.Length) } finally { $authFile.Dispose() }
    }
    if ($verifyCode -ne 0 -or $verification.ok -ne $true) { throw "Password does not match OWNER. Release not started; do not retry automatically." }
    if ($ReadinessFile) {
        $plain = $null
        Write-Host "Password verified. Waiting for the independent QA readiness gate; no release writes yet."
        while (-not (Test-Path -LiteralPath $ReadinessFile)) { Start-Sleep -Seconds 1 }
        $ready = Get-Content -LiteralPath $ReadinessFile -Raw | ConvertFrom-Json
        if ($ready.ready -ne $true -or $ready.database -ne $databasePath) { throw "Readiness gate rejected; no release started." }
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    $continuationNumber = 0
    do {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = (Get-Command node).Source
    $info.Arguments = '"' + $tsx + '" "' + $releaseScript + '"'
    $info.WorkingDirectory = $repoRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.EnvironmentVariables['STAGE7A1_OWNER_PASSWORD'] = $plain
    $info.EnvironmentVariables['STAGE7_PRODUCTION_BASE_URL'] = $baseUrl
    $info.EnvironmentVariables['STAGE7_RELEASE_DATABASE'] = $databasePath
    $info.EnvironmentVariables.Remove('STAGE7_RELEASE_VERIFY_LIMIT')
    $info.EnvironmentVariables['STAGE7_BROWSER_CHANNEL'] = 'chrome'
    $info.EnvironmentVariables.Remove('STAGE7_RELEASE_PUBLISH_ONLY')
    if ($PublishOnly) { $info.EnvironmentVariables['STAGE7_RELEASE_PUBLISH_ONLY'] = 'yes' }
    if ($ResultPath) { $info.EnvironmentVariables['STAGE7_RELEASE_RESULT'] = $ResultPath }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    [void]$process.Start()
    $info.EnvironmentVariables.Remove('STAGE7A1_OWNER_PASSWORD')
    $plain = $null
    $process.WaitForExit()
    $code = $process.ExitCode
    $process.Dispose()
    Write-Host "Release exit code: $code"
    if ($code -eq 0 -or -not $PublishOnly -or -not $ResumeControlPath) { break }
    Write-Host "Paused safely. Keep this window open. Waiting for a reviewed publish-only continuation; no automatic retry."
    while (-not (Test-Path -LiteralPath $ResumeControlPath)) { Start-Sleep -Seconds 1 }
    $continuation = Get-Content -LiteralPath $ResumeControlPath -Raw | ConvertFrom-Json
    if ($continuation.action -ne "resume" -or $continuation.database -ne $databasePath) { break }
    if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($continuation.resultPath)) -ne [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ResultPath))) { throw "Continuation result must remain in the same local directory." }
    if (Test-Path -LiteralPath $continuation.resultPath) { throw "Continuation result already exists." }
    $ResultPath = $continuation.resultPath
    $continuationNumber++
    [IO.File]::Move($ResumeControlPath, "$ResumeControlPath.consumed-$continuationNumber")
    } while ($true)
} finally {
    $plain = $null
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $secure.Dispose()
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
exit $code
