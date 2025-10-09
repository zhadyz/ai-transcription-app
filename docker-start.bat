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

REM ============================================================================
REM SMART IP DETECTION - Prioritize 192.168.1.x, Exclude Virtual Adapters
REM ============================================================================

echo [INFO] Detecting network IP address...

REM Try to find 192.168.1.x first (main network)
for /f "tokens=14" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr "192.168.1."') do (
    set NETWORK_IP=%%a
    goto :ip_found
)

REM Fallback: Find any 192.168.x.x (excluding virtual adapters)
setlocal enabledelayedexpansion
set FOUND_IP=
for /f "tokens=1,* delims=:" %%a in ('ipconfig ^| findstr /c:"adapter" /c:"IPv4"') do (
    set LINE=%%a %%b
    
    REM Check if this is an adapter line
    echo !LINE! | findstr /i "VMware VirtualBox Hyper-V WSL" >nul
    if errorlevel 1 (
        REM Not a virtual adapter, check next line for IPv4
        for /f "tokens=14" %%c in ('echo %%b') do (
            echo %%c | findstr /r "192\.168\.[0-9]*\.[0-9]*" >nul
            if not errorlevel 1 (
                set FOUND_IP=%%c
                goto :break_loop
            )
        )
    )
)
:break_loop
endlocal & set NETWORK_IP=%FOUND_IP%

:ip_found

REM If no IP found, use localhost
if not defined NETWORK_IP (
    echo [WARN] Could not detect network IP, using localhost
    set NETWORK_IP=localhost
) else (
    echo [OK] Network IP detected: %NETWORK_IP%
)

echo.

REM ============================================================================
REM BUILD AND START CONTAINERS
REM ============================================================================

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

REM ============================================================================
REM INTELLIGENT HEALTH CHECKS - Wait for services to be truly ready
REM ============================================================================

echo.
echo ========================================
echo   Waiting for Services to Initialize
echo ========================================
echo.

REM Check if curl is available
where curl >nul 2>&1
if errorlevel 1 (
    echo [WARN] curl not found, using basic wait...
    echo [INFO] Waiting 15 seconds...
    timeout /t 15 /nobreak >nul
    goto :services_ready
)

REM ============================================================================
REM 1. Wait for Backend Health
REM ============================================================================

echo [1/3] Checking backend health...
set BACKEND_READY=0
set BACKEND_ATTEMPTS=0
set MAX_ATTEMPTS=30

:check_backend
set /a BACKEND_ATTEMPTS+=1
curl -s -o nul -w "%%{http_code}" http://%NETWORK_IP%:8000/health | findstr "200" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Backend is healthy
    set BACKEND_READY=1
    goto :backend_done
)

if %BACKEND_ATTEMPTS% GEQ %MAX_ATTEMPTS% (
    echo [WARN] Backend health check timeout, continuing anyway...
    goto :backend_done
)

timeout /t 1 /nobreak >nul
goto :check_backend

:backend_done

REM ============================================================================
REM 2. Wait for Frontend to Serve Content
REM ============================================================================

echo [2/3] Checking frontend is serving...
set FRONTEND_READY=0
set FRONTEND_ATTEMPTS=0

:check_frontend
set /a FRONTEND_ATTEMPTS+=1
curl -s -o nul -w "%%{http_code}" http://%NETWORK_IP% | findstr "200" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Frontend is serving
    set FRONTEND_READY=1
    goto :frontend_done
)

if %FRONTEND_ATTEMPTS% GEQ %MAX_ATTEMPTS% (
    echo [WARN] Frontend check timeout, continuing anyway...
    goto :frontend_done
)

timeout /t 1 /nobreak >nul
goto :check_frontend

:frontend_done

REM ============================================================================
REM 3. Wait for Session Creation to Work
REM ============================================================================

echo [3/3] Testing session creation...
set SESSION_READY=0
set SESSION_ATTEMPTS=0

:check_session
set /a SESSION_ATTEMPTS+=1

REM Try to create a test session
curl -s -X POST -H "Content-Type: application/json" http://%NETWORK_IP%:8000/session/create 2>nul | findstr "session_id" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Session creation working
    set SESSION_READY=1
    goto :session_done
)

if %SESSION_ATTEMPTS% GEQ %MAX_ATTEMPTS% (
    echo [WARN] Session creation check timeout, continuing anyway...
    goto :session_done
)

timeout /t 1 /nobreak >nul
goto :check_session

:session_done

REM ============================================================================
REM 4. Give app time to fully initialize React
REM ============================================================================

echo.
echo [INFO] Waiting for React app to initialize...
timeout /t 3 /nobreak >nul

:services_ready
echo.
echo [OK] All services ready!
echo.

REM ============================================================================
REM OPEN BROWSER
REM ============================================================================

echo [INFO] Opening browser...
start http://%NETWORK_IP%

REM ============================================================================
REM SUCCESS MESSAGE
REM ============================================================================

echo.
echo ========================================
echo   SUCCESS - App is Running!
echo ========================================
echo.
echo Access your app:
echo.
echo   Desktop:   http://%NETWORK_IP%
echo   Backend:   http://%NETWORK_IP%:8000
echo   Translate: http://%NETWORK_IP%:5000
echo.
echo ========================================
echo Mobile Instructions:
echo ========================================
echo.
echo   1. The app is already open on this computer
echo   2. Scan the QR code that appears on screen
echo   3. Your phone will connect automatically!
echo.
echo   QR Code will show: http://%NETWORK_IP%/mobile-upload
echo.
echo ========================================
echo Useful Commands:
echo ========================================
echo   View logs:    docker-compose logs -f
echo   Stop:         docker-compose down
echo   Restart:      docker-compose restart
echo   Rebuild:      docker-compose up --build -d
echo ========================================
echo.
pause