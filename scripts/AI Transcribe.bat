@echo off
title AI Transcription App - Universal Launcher
color 0B

REM ============================================================================
REM  AI TRANSCRIPTION APP - UNIVERSAL LAUNCHER
REM ============================================================================
REM  Automatically detects your environment and runs the right installation
REM  One command does everything!
REM ============================================================================

cls
echo.
echo ========================================================================
echo   AI TRANSCRIPTION APP - V1.5.3
echo ========================================================================
echo.
echo   Universal Launcher - One command to rule them all!
echo.
echo ========================================================================
echo.

REM Check if this is first run (no venv/node_modules)
set FIRST_RUN=0

if not exist "backend\venv" set FIRST_RUN=1
if not exist "frontend\node_modules" set FIRST_RUN=1

if %FIRST_RUN%==1 (
    echo [FIRST RUN DETECTED] - Installation required
    echo.
    echo This will install:
    echo   - Python 3.11 virtual environment
    echo   - PyTorch with CUDA support
    echo   - All backend dependencies
    echo   - Frontend dependencies
    echo   - SSL certificates (optional)
    echo.
    
    choice /C YN /M "Run installation now"
    if errorlevel 2 goto :eof
    if errorlevel 1 (
        echo.
        echo Starting installation...
        echo.
        call scripts\install.bat
        
        if errorlevel 1 (
            echo.
            echo [ERROR] Installation failed!
            pause
            goto :eof
        )
        
        echo.
        echo Installation complete!
        echo.
        timeout /t 3 /nobreak >nul
    )
)

REM ============================================================================
REM DETECT ENVIRONMENT - Docker or Manual?
REM ============================================================================

echo Detecting environment...
echo.

REM Check if Docker is available
docker info >nul 2>&1
if %errorlevel%==0 (
    set DOCKER_AVAILABLE=1
    echo [OK] Docker Desktop detected
) else (
    set DOCKER_AVAILABLE=0
    echo [INFO] Docker not running or not installed
)

REM Check if manual mode is set up
if exist "backend\venv\Scripts\activate.bat" (
    set MANUAL_AVAILABLE=1
    echo [OK] Manual installation detected
) else (
    set MANUAL_AVAILABLE=0
    echo [WARN] Manual mode not installed
)

echo.

REM ============================================================================
REM CHOOSE MODE
REM ============================================================================

if %DOCKER_AVAILABLE%==1 if %MANUAL_AVAILABLE%==1 (
    REM Both available - let user choose
    echo You have both Docker and Manual mode available!
    echo.
    echo [1] Docker Mode (Recommended - Production ready)
    echo [2] Manual Mode (Development - Hot reload)
    echo [3] Exit
    echo.
    choice /C 123 /M "Choose mode"
    
    if errorlevel 3 goto :eof
    if errorlevel 2 goto :manual
    if errorlevel 1 goto :docker
)

if %DOCKER_AVAILABLE%==1 (
    echo Starting in Docker mode...
    goto :docker
)

if %MANUAL_AVAILABLE%==1 (
    echo Starting in Manual mode...
    goto :manual
)

REM Neither available
echo [ERROR] No valid installation found!
echo.
echo Please run: scripts\install.bat
echo.
pause
goto :eof

REM ============================================================================
REM DOCKER MODE
REM ============================================================================
:docker
echo.
echo ========================================================================
echo   DOCKER MODE
echo ========================================================================
echo.
call scripts\start-docker.bat
goto :eof

REM ============================================================================
REM MANUAL MODE
REM ============================================================================
:manual
echo.
echo ========================================================================
echo   MANUAL MODE
echo ========================================================================
echo.
call scripts\start-manual.bat
goto :eof