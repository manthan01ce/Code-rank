# CodeRank - Complete Load Test Suite Runner
# Tests: Smoke -> API Load -> WebSocket -> Execution/Concurrency -> Submission
# Caching is ENABLED by default. Use -DisableCacheForTestingOnly switch for raw DB tests.
param(
    [switch]$DisableCacheForTestingOnly = $false
)

$BASE_URL    = "http://localhost:3000"
$K6          = (Get-Command k6 -ErrorAction Stop).Source
$SCRIPT_DIR  = Split-Path -Parent $PSScriptRoot
$REPORTS_DIR = "$SCRIPT_DIR\reports"
$TIMESTAMP   = (Get-Date -Format "yyyy-MM-dd_HH-mm-ss")

# JWT Tokens (Freshly obtained)
$STUDENT_TOKEN = $env:JWT_TOKEN
$FACULTY_TOKEN = $env:FACULTY_TOKEN
$PRACTICAL_ID  = "1"
$COURSE_ID     = "5"

New-Item -ItemType Directory -Force -Path $REPORTS_DIR | Out-Null

$script_results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Run-Test {
    param(
        [string]$TestName,
        [string]$Script,
        [string[]]$Extra = @()
    )

    $scriptPath = Join-Path $SCRIPT_DIR "scenarios/$Script"
    if ($Script -eq "runner-concurrency-benchmark.js") {
        $scriptPath = Join-Path $PSScriptRoot $Script
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  RUNNING: $TestName" -ForegroundColor Yellow
    Write-Host "  Script : $Script" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Cyan

    $k6Args = @(
        "run",
        "-e", "BASE_URL=$BASE_URL",
        "-e", "JWT_TOKEN=$STUDENT_TOKEN",
        "-e", "FACULTY_TOKEN=$FACULTY_TOKEN",
        "-e", "PRACTICAL_ID=$PRACTICAL_ID",
        "-e", "COURSE_ID=$COURSE_ID",
        "-e", "DISABLE_RATE_LIMIT=true",
        "-e", ("DISABLE_CACHE=" + ($DisableCacheForTestingOnly ? "true" : "false"))
    ) + $Extra + @($scriptPath)

    $t0 = Get-Date
    & $K6 @k6Args
    $code = $LASTEXITCODE
    $dur  = ((Get-Date) - $t0).ToString("mm\:ss")

    $status = if ($code -eq 0) { "PASSED" } else { "THRESHOLDS BREACHED" }
    $color  = if ($code -eq 0) { "Green"  } else { "Yellow" }
    Write-Host ""
    Write-Host "  >> $status  |  $TestName  |  ${dur}s" -ForegroundColor $color
    Write-Host ""

    $script_results.Add([PSCustomObject]@{
        Test     = $TestName
        Script   = $Script
        Status   = $status
        ExitCode = $code
        Duration = $dur
    })

    Start-Sleep -Seconds 5
}

# PRE-TEST HEALTH CHECK
Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  CodeRank Full Load Test Suite  -  $TIMESTAMP" -ForegroundColor Yellow
Write-Host "  Cache        : $(if ($DisableCacheForTestingOnly) { 'DISABLED (raw DB test mode)' } else { 'ENABLED (micro-cache active)' })" -ForegroundColor $(if ($DisableCacheForTestingOnly) { 'Red' } else { 'Green' })
Write-Host "  Rate Limiting: DISABLED" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

$health = Invoke-RestMethod -Uri "$BASE_URL/api/health" -ErrorAction SilentlyContinue
if ($health.status -ne "healthy") {
    Write-Host "  ERROR: Server not healthy. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "  Health : OK  |  DB: $($health.services.database.status)  |  Workers: $($health.services.execution.healthyWorkers)" -ForegroundColor Green

$cacheHdr = (& curl.exe -s -I "$BASE_URL/api/health" 2>&1 | Select-String "x-cache").ToString().Trim()
Write-Host "  $cacheHdr" -ForegroundColor Green
Write-Host ""
Write-Host "  Starting tests in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# ===== TEST 1: SMOKE TEST =====
Run-Test -TestName "1. Smoke Test - Health and Sanity (20 VU, 25s)" `
         -Script "smoke-test.js"

# ===== TEST 2: API LOAD TEST =====
Run-Test -TestName "2. API Load Test - Concurrent Users (150 VU, 2m)" `
         -Script "api-load-test.js"

# ===== TEST 3: WEBSOCKET + POLLING TEST =====
Run-Test -TestName "3. WebSocket and Polling Load Test (300 VU, 2m30s)" `
         -Script "websocket-polling-test.js"

# ===== TEST 4: RUNNER CONCURRENCY - CODE EXECUTION =====
Run-Test -TestName "4. Runner Concurrency - Code Execution Benchmark (8 VU, 60s)" `
         -Script "runner-concurrency-benchmark.js" `
         -Extra @("-e", "VUS=8", "-e", "DURATION=60s", "-e", "MAX_WAIT_SECONDS=30")

# ===== TEST 5: SUBMISSION LOAD TEST =====
Run-Test -TestName "5. Submission Load Test - Full Lab Session (120 students)" `
         -Script "submission-load-test.js"

# ===== FINAL SUMMARY =====
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  FINAL TEST RESULTS SUMMARY" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
foreach ($r in $script_results) {
    $color = if ($r.ExitCode -eq 0) { "Green" } else { "Yellow" }
    $icon  = if ($r.ExitCode -eq 0) { "[PASS]" } else { "[WARN]" }
    Write-Host "  $icon  $($r.Test)  ($($r.Duration)s)" -ForegroundColor $color
    if ($r.ExitCode -eq 0) { $passed++ }
}

Write-Host ""
Write-Host "  Result: $passed / $($script_results.Count) tests passed all thresholds" -ForegroundColor $(if ($passed -eq $script_results.Count) { "Green" } else { "Yellow" })
Write-Host "  Reports: $REPORTS_DIR\" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
