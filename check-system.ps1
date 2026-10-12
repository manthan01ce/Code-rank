# CodeRank System Health Check Script
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "CodeRank System Health Check" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0

# 1. Check Docker
Write-Host "`n--- Docker Status ---" -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker Installed: $dockerVersion" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Docker not found" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] Docker not found" -ForegroundColor Red
    $failed++
}

# 2. Check Docker Containers
Write-Host "`n--- Docker Containers ---" -ForegroundColor Yellow
$containers = @("coderank-redis", "coderank-python-daemon", "coderank-cpp-daemon", "coderank-c-daemon", "coderank-java-daemon", "coderank-javascript-daemon")

foreach ($container in $containers) {
    try {
        $status = docker inspect -f '{{.State.Status}}' $container 2>&1
        if ($LASTEXITCODE -eq 0 -and $status -eq "running") {
            Write-Host "[OK] $container : running" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "[FAIL] $container : $status" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "[FAIL] $container : not found" -ForegroundColor Red
        $failed++
    }
}

# 3. Check Redis
Write-Host "`n--- Redis Connection ---" -ForegroundColor Yellow
try {
    $redisPing = docker exec coderank-redis redis-cli ping 2>&1
    if ($redisPing -match "PONG") {
        Write-Host "[OK] Redis Connection: PONG" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Redis Connection failed" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] Cannot connect to Redis" -ForegroundColor Red
    $failed++
}

# 4. Check .env
Write-Host "`n--- Environment Configuration ---" -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "[OK] .env file exists" -ForegroundColor Green
    $passed++
} else {
    Write-Host "[FAIL] .env file missing - copy .env.example to .env" -ForegroundColor Red
    $failed++
}

# 5. Check Node.js
Write-Host "`n--- Node.js ---" -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Node.js not found" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] Node.js not installed" -ForegroundColor Red
    $failed++
}

# 6. Check Dependencies
Write-Host "`n--- Dependencies ---" -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "[OK] Root dependencies installed" -ForegroundColor Green
    $passed++
} else {
    Write-Host "[FAIL] Run 'npm install' in root" -ForegroundColor Red
    $failed++
}

if (Test-Path "apps\web\node_modules") {
    Write-Host "[OK] Web app dependencies installed" -ForegroundColor Green
    $passed++
} else {
    Write-Host "[FAIL] Web dependencies missing" -ForegroundColor Red
    $failed++
}

if (Test-Path "apps\worker\node_modules") {
    Write-Host "[OK] Worker dependencies installed" -ForegroundColor Green
    $passed++
} else {
    Write-Host "[FAIL] Worker dependencies missing" -ForegroundColor Red
    $failed++
}

# Summary
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

if ($failed -eq 0) {
    Write-Host "`n✓ All systems ready!" -ForegroundColor Green
    Write-Host "`nStart servers with:" -ForegroundColor Cyan
    Write-Host "  npm run web    # Web server" -ForegroundColor White
    Write-Host "  npm run worker # Worker (new terminal)" -ForegroundColor White
} else {
    Write-Host "`n⚠ Fix issues above first" -ForegroundColor Yellow
}
