@echo off
:: =============================================================================
::  AI Transcription App - ONE-CLICK START
:: =============================================================================

cd /d "%~dp0"
cls

echo.
echo ========================================
echo    Starting Transcription App...
echo ========================================
echo.

:: Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo [X] Docker Desktop is not running!
    echo.
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is ready
echo.

:: Detect IP Address (prioritize 192.168.1.x)
echo [*] Detecting your network address...
for /f "tokens=14" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr "192.168.1."') do (
    set NETWORK_IP=%%a
    goto :ip_found
)

:: Fallback to any 192.168.x.x
for /f "tokens=14" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr "192.168."') do (
    set NETWORK_IP=%%a
    goto :ip_found
)

:: Last resort: localhost
set NETWORK_IP=localhost

:ip_found
echo [OK] Network: %NETWORK_IP%
echo.

:: Start containers
echo [*] Starting services...
echo     (First time: 5-10 minutes to download)
echo.

docker-compose up -d

if errorlevel 1 (
    echo.
    echo [X] Failed to start. Try: docker-compose logs
    pause
    exit /b 1
)

:: Wait for services
echo.
echo [*] Waiting for services to initialize...
timeout /t 10 /nobreak >nul

:: Create info file
echo Your App Address: http://%NETWORK_IP% > APP-INFO.txt
echo Backend API: http://%NETWORK_IP%:8000 >> APP-INFO.txt
echo. >> APP-INFO.txt
echo Mobile Access: >> APP-INFO.txt
echo   1. Open the app on this computer >> APP-INFO.txt
echo   2. Click "Mobile Upload" >> APP-INFO.txt
echo   3. Scan the QR code with your phone >> APP-INFO.txt

:: Open browser
echo [*] Opening app in browser...
start http://%NETWORK_IP%

cls
echo.
echo ========================================
echo       APP IS RUNNING!
echo ========================================
echo.
echo   YOUR ADDRESS:
echo.
echo     http://%NETWORK_IP%
echo.
echo ========================================
echo.
echo   MOBILE ACCESS:
echo     1. Open app on this computer
echo     2. Scan the QR code on screen
echo.
echo ========================================
echo.
echo   COMMANDS:
echo     Stop:     docker-compose down
echo     Logs:     docker-compose logs -f
echo     Restart:  docker-compose restart
echo.
echo ========================================
echo.
echo   INFO SAVED TO: APP-INFO.txt
echo.
echo ========================================
echo.
pause
