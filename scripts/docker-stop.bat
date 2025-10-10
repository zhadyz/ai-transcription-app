@echo off
cd /d "%~dp0.."
echo Stopping all containers...
docker-compose down
echo.
echo Containers stopped.
pause