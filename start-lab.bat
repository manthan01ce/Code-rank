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

:: Check for Administrator privileges to configure firewall
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Running as Administrator. Configuring Windows Firewall for Port 3000...
    netsh advfirewall firewall show rule name="CodeRank-Frontend" >nul 2>&1
    if not %errorLevel% == 0 (
        netsh advfirewall firewall add rule name="CodeRank-Frontend" dir=in action=allow protocol=TCP localport=3000 >nul
        echo [SUCCESS] Windows Firewall rule added for port 3000.
    ) else (
        echo [INFO] Windows Firewall rule already exists.
    )
) else (
    echo [WARNING] Not running as Administrator.
    echo If other PCs cannot connect, right-click this script and "Run as Administrator", or run this command in an Admin prompt:
    echo netsh advfirewall firewall add rule name="CodeRank-Frontend" dir=in action=allow protocol=TCP localport=3000
)
echo.

:: 1. Copy env if missing
if not exist "frontend\.env.local" (
    if exist ".env.local" copy ".env.local" "frontend\.env.local" >nul
)
if not exist "backend\.env.local" (
    if exist ".env.local" copy ".env.local" "backend\.env.local" >nul
)

:: Check dependencies
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend && npm install && cd ..
)
if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd backend && npm install && cd ..
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
