@echo off
cd /d "%~dp0"
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

:: Active workspaces load the root environment.
if not exist ".env" if not exist ".env.local" (
    echo [ERROR] Create .env from .env.example and configure Neon and JWT_SECRET.
    exit /b 1
)
if not exist "node_modules" (
    call npm ci --no-audit --no-fund
    if errorlevel 1 exit /b 1
)
docker compose -f infrastructure\docker-compose.yml --profile build-image build runner-image
if errorlevel 1 exit /b 1
docker compose -f infrastructure\docker-compose.yml up -d redis
if errorlevel 1 exit /b 1
set HOSTNAME=0.0.0.0
set PORT=3000
if not defined ALLOWED_ORIGIN set ALLOWED_ORIGIN=http://localhost:3000,http://!HOST_IP!:3000
start "CodeRank Worker" cmd /k "npm run worker"
call npm run web
