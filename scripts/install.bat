@echo off

REM Change to root directory (one level up from scripts/)
cd /d "%~dp0.."

REM Run the PowerShell startup script
powershell.exe -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause