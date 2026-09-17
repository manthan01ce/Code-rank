@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo     CodeRank Educational Platform - Local Lab Server
echo ========================================================
echo.

:: Detect local IPv4 address
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0 "') do (
    if not defined HOST_IP set HOST_IP=%%a
)
if not defined HOST_IP set HOST_IP=localhost

echo  Server Local IP    : !HOST_IP!
echo  Student / Lab Portal: http://!HOST_IP!:3000
echo  Localhost Access    : http://localhost:3000
echo ========================================================
echo.

:: 1. Copy env if missing
if not exist "frontend\.env.local" (
    if exist ".env.local" copy ".env.local" "frontend\.env.local" >nul
)
if not exist "backend\.env.local" (
    if exist ".env.local" copy ".env.local" "backend\.env.local" >nul
)

:: 2. Start Redis and compiler daemons in Docker
echo [1/3] Starting Redis and compiler daemons...
docker compose -f runner\docker-compose.yml up -d --build
if errorlevel 1 (
    echo [ERROR] Failed to start Docker containers. Make sure Docker Desktop is running.
    pause
    exit /b 1
)

:: 3. Start Backend Worker in separate window
echo [2/3] Starting backend worker...
start "CodeRank Backend Worker" cmd /k "cd backend && node src\worker.js"

:: 4. Start Frontend
echo [3/3] Starting frontend server on 0.0.0.0:3000...
set HOSTNAME=0.0.0.0
set PORT=3000
cd frontend
node server.js
