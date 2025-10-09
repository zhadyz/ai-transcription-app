@echo off
cls
echo ========================================
echo   AI Transcription App - Docker
echo ========================================
echo.

REM Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running!
    echo.
    echo Please start Docker Desktop first.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Get network IP for display
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr "192.168"') do set NETWORK_IP=%%a
set NETWORK_IP=%NETWORK_IP: =%

echo Building and starting containers...
echo (First time: 5-10 minutes to download base images)
echo.

docker-compose up --build -d

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start containers!
    echo.
    echo Check logs: docker-compose logs
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SUCCESS - App is Running!
echo ========================================
echo.
echo Access your app:
echo.
echo   Desktop:  http://localhost
if defined NETWORK_IP (
    echo   Mobile:   http://%NETWORK_IP%
)
echo.
echo   Backend:  http://localhost:8000
echo   Translate: http://localhost:5000
echo.
echo Mobile Instructions:
echo   1. Open http://localhost on this computer
echo   2. Scan QR code with your phone
echo   3. Your phone will connect automatically!
echo.
echo ----------------------------------------
echo Useful Commands:
echo ----------------------------------------
echo   View logs:    docker-compose logs -f
echo   Stop:         docker-compose down
echo   Restart:      docker-compose restart
echo   Rebuild:      docker-compose up --build -d
echo ========================================
echo.
pause