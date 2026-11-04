@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo ========================================================
echo     CodeRank Educational Platform - Local Lab Server
echo ========================================================
echo.

:: Resolve dotenv settings before defaults/firewall setup. The Node bridge
:: re-enters this script once with the selected environment; no .env evaluation.
if /I "%~1"=="--resolved-env" goto resolved_env
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Install Node.js 24 or newer before running the launcher.
    exit /b 1
)
node scripts\dev\lab-launcher.mjs
exit /b %errorlevel%
:resolved_env

:: Detect local IPv4 address
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0 "') do (
    if not defined HOST_IP set HOST_IP=%%a
)
if not defined HOST_IP set HOST_IP=localhost

:: Resolve the effective port once, early. A user-provided PORT always wins;
:: the default is 3000.
if not defined PORT set PORT=3000

echo  Server Local IP    : !HOST_IP!
echo  Student / Lab Portal: http://!HOST_IP!:!PORT!
echo  Localhost Access    : http://localhost:!PORT!
echo ========================================================
echo.

:: Check for Administrator privileges to configure firewall
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Running as Administrator. Configuring Windows Firewall for Port !PORT!...
    netsh advfirewall firewall show rule name="CodeRank-Frontend" >nul 2>&1
    if not %errorLevel% == 0 (
        netsh advfirewall firewall add rule name="CodeRank-Frontend" dir=in action=allow protocol=TCP localport=!PORT! >nul
        echo [SUCCESS] Windows Firewall rule added for port !PORT!.
    ) else (
        echo [INFO] Windows Firewall rule already exists.
    )
) else (
    echo [WARNING] Not running as Administrator.
    echo If other PCs cannot connect, right-click this script and "Run as Administrator", or run this command in an Admin prompt:
    echo netsh advfirewall firewall add rule name="CodeRank-Frontend" dir=in action=allow protocol=TCP localport=!PORT!
)
echo.

:: Active workspaces load the root environment.
if not exist ".env" if not exist ".env.local" (
    echo [ERROR] Create .env from .env.example and configure DATABASE_URL and JWT_SECRET.
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
if not defined ALLOWED_ORIGIN set ALLOWED_ORIGIN=http://localhost:!PORT!,http://!HOST_IP!:!PORT!
:: Derive REALTIME_URL from the effective port when no explicit value exists.
if not defined REALTIME_URL set REALTIME_URL=http://127.0.0.1:!PORT!
start "CodeRank API" cmd /k "npm run api"
start "CodeRank Worker" cmd /k "npm run worker"
call npm run web
