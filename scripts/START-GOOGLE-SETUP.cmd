@echo off
title NMT Academy - Google OAuth setup
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-google-local.ps1"
echo.
pause
