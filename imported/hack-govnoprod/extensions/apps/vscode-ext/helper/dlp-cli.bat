@echo off
setlocal enabledelayedexpansion
set PS1=%~dp0dlp-cli.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
exit /b %ERRORLEVEL%


