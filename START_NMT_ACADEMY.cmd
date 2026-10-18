@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 (
  echo ERROR: Could not enter the NMT Academy project folder.
  pause
  exit /b 1
)

where node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available in PATH.
  pause
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is not available in PATH.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo ERROR: package.json was not found. Check the project folder.
  pause
  exit /b 1
)

if not exist ".env" (
  echo ERROR: .env was not found. The app needs its existing local configuration.
  pause
  exit /b 1
)

if not exist "node_modules\next\dist\bin\next" (
  echo ERROR: Next.js dependencies are missing. Install dependencies with npm install, then try again.
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo ERROR: Port 3000 is already in use or could not be checked.
  echo No process was stopped. Check the existing app before trying again.
  pause
  exit /b 1
)

echo Starting NMT Academy at http://localhost:3000
echo Keep this window open while using the site. Press Ctrl+C to stop the app.
echo No database reset, seed, or migration will be run.
call npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
set "APP_EXIT=%ERRORLEVEL%"

if not "%APP_EXIT%"=="0" (
  echo.
  echo NMT Academy stopped with exit code %APP_EXIT%. Review the error above.
)
pause
exit /b %APP_EXIT%
