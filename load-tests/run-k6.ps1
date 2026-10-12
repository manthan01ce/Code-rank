# ============================================================
# CodeRank — Grafana k6 Full Load Test Suite Runner
# ============================================================
# Usage:
#   .\load-tests\run-k6.ps1 -Test smoke
#   .\load-tests\run-k6.ps1 -Test websocket -BaseUrl http://192.168.1.100:3000
#   .\load-tests\run-k6.ps1 -Test max -JwtToken "your_jwt" -DisableRateLimit
#   .\load-tests\run-k6.ps1 -Test all -JwtToken "student_token" -FacultyToken "faculty_token"
#
# Available -Test values:
#   smoke        Quick health/sanity check (20s)
#   smoke-100    100 VU smoke test (100s)
#   stress       Stress test with 500 VU peak (8m)
#   api          API & Gateway load (2m)
#   execution    BullMQ execution pipeline stress (2m)
#   websocket    WebSocket + polling connection load
#   ratelimit    Rate limiting validation (deliberately triggers 429s)
#   submission   Full lab session: concurrent student submissions
#   max          Maximum capacity / server break point finder
#   all          Run all tests sequentially
# ============================================================

param (
    [ValidateSet("smoke", "smoke-100", "stress", "api", "execution", "websocket", "ratelimit", "submission", "max", "all")]
    [string]$Test = "smoke",

    [string]$BaseUrl        = "http://localhost:3000",
    [string]$JwtToken       = "",          # Student JWT
    [string]$FacultyToken   = "",          # Faculty JWT (for submission test)
    [string]$PracticalId    = "1",
    [string]$CourseId       = "1",
    [string]$JobId          = "",

    [switch]$DisableRateLimit,             # Add DISABLE_RATE_LIMIT=true env var
    [switch]$DisableCache,                 # Add DISABLE_CACHE=true env var
    [switch]$HtmlReport                    # Save k6 HTML report (requires k6-reporter)
)

# ─── Locate k6 executable ─────────────────────────────────────────────────────
$k6Path = "k6"
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    $candidates = @(
        "C:\Program Files\k6\k6.exe",
        "$env:LOCALAPPDATA\Programs\k6\k6.exe",
        "$env:USERPROFILE\scoop\shims\k6.exe"
    )
    $found = $false
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $env:Path = "$(Split-Path $c);$env:Path"
            $found = $true
            break
        }
    }
    if (-not $found) {
        Write-Host ""
        Write-Host "[ERROR] k6 not found. Install it with:" -ForegroundColor Red
        Write-Host "   winget install k6" -ForegroundColor Yellow
        Write-Host "   choco install k6" -ForegroundColor Yellow
        Write-Host "   scoop install k6" -ForegroundColor Yellow
        exit 1
    }
}

# ─── Banner ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   CodeRank  —  Grafana k6 Load & Stress Test Suite" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Target URL   : $BaseUrl" -ForegroundColor Green
Write-Host "  k6 Version   : $(k6 version)" -ForegroundColor Gray
Write-Host "  Test Mode    : $Test" -ForegroundColor Magenta
Write-Host "  Practical ID : $PracticalId  |  Course ID: $CourseId" -ForegroundColor Gray
if ($JwtToken)      { Write-Host "  Student Auth : Configured" -ForegroundColor Gray }
if ($FacultyToken)  { Write-Host "  Faculty Auth : Configured" -ForegroundColor Gray }
if ($DisableRateLimit) { Write-Host "  [!] Rate Limiting : DISABLED (raw server load)" -ForegroundColor Red }
if ($DisableCache)     { Write-Host "  [!] Cache         : DISABLED" -ForegroundColor Red }
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ─── Runner Function ──────────────────────────────────────────────────────────
function Run-K6Test {
    param (
        [string]$Name,
        [string]$ScriptFile,
        [string]$ExtraEnv = ""
    )

    Write-Host ">>> [RUNNING] $Name" -ForegroundColor Magenta
    Write-Host "    Script: $ScriptFile" -ForegroundColor DarkGray
    Write-Host ""

    $fullPath = Join-Path $scriptDir $ScriptFile

    # Build -e arguments
    $envArgs = "-e BASE_URL=$BaseUrl"
    if ($JwtToken)      { $envArgs += " -e JWT_TOKEN=$JwtToken" }
    if ($FacultyToken)  { $envArgs += " -e FACULTY_TOKEN=$FacultyToken" }
    if ($PracticalId)   { $envArgs += " -e PRACTICAL_ID=$PracticalId" }
    if ($CourseId)      { $envArgs += " -e COURSE_ID=$CourseId" }
    if ($JobId)         { $envArgs += " -e JOB_ID=$JobId" }
    if ($DisableRateLimit) { $envArgs += " -e DISABLE_RATE_LIMIT=true" }
    if ($DisableCache)     { $envArgs += " -e DISABLE_CACHE=true" }
    if ($ExtraEnv)      { $envArgs += " $ExtraEnv" }

    $cmd = "k6 run $envArgs `"$fullPath`""

    if ($HtmlReport) {
        $reportFile = Join-Path $scriptDir "reports\$(($ScriptFile -replace '.js',''))-report.html"
        New-Item -ItemType Directory -Force -Path (Join-Path $scriptDir "reports") | Out-Null
        $cmd += " --out json=$(Join-Path $scriptDir "reports\$(($ScriptFile -replace '.js',''))-results.json")"
    }

    Write-Host "    CMD: $cmd" -ForegroundColor DarkGray
    Write-Host ""

    Invoke-Expression $cmd

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host ">>> [PASSED] $Name" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host ">>> [THRESHOLDS BREACHED / FAILED] $Name" -ForegroundColor Yellow
        Write-Host "    Review metrics above. Exit code: $LASTEXITCODE" -ForegroundColor DarkGray
    }

    Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

# ─── Dispatch ─────────────────────────────────────────────────────────────────
switch ($Test.ToLower()) {

    "smoke" {
        Run-K6Test `
            -Name "Smoke Test — Quick Health & Sanity Check (20s)" `
            -ScriptFile "smoke-test.js"
    }

    "smoke-100" {
        Run-K6Test `
            -Name "100 VU Smoke Test — High Concurrency Health Check (100s)" `
            -ScriptFile "smoke-test-100vu.js"
    }

    "stress" {
        Run-K6Test `
            -Name "Stress Test — 500 VU Peak Load Test (8m)" `
            -ScriptFile "stress-test.js"
    }

    "api" {
        Run-K6Test `
            -Name "API & Gateway Load Test — Concurrent Users (2m)" `
            -ScriptFile "api-load-test.js"
    }

    "execution" {
        Run-K6Test `
            -Name "Execution Engine & BullMQ Stress Test (2m)" `
            -ScriptFile "execution-stress-test.js"
    }

    "websocket" {
        Run-K6Test `
            -Name "WebSocket & Polling Connection Load Test (2m30s)" `
            -ScriptFile "websocket-polling-test.js"
    }

    "ratelimit" {
        Write-Host "[NOTE] Rate limit test intentionally sends >limit requests." -ForegroundColor Yellow
        Write-Host "       Expected outcome: many 429 responses. This is CORRECT behaviour." -ForegroundColor Yellow
        Write-Host ""
        Run-K6Test `
            -Name "Rate Limiting Validation Test (2m)" `
            -ScriptFile "rate-limit-test.js"
    }

    "submission" {
        if (-not $JwtToken) {
            Write-Host "[WARN] No -JwtToken provided. Submission test will test unauthenticated paths." -ForegroundColor Yellow
        }
        Run-K6Test `
            -Name "Submission Load Test — Full Lab Session Simulation (2m15s)" `
            -ScriptFile "submission-load-test.js"
    }

    "max" {
        Write-Host "============================================================" -ForegroundColor Red
        Write-Host "  WARNING: Maximum Capacity Test" -ForegroundColor Red
        Write-Host "  This test WILL saturate/crash the server." -ForegroundColor Red
        Write-Host "  Ensure DISABLE_RATE_LIMIT=true is configured." -ForegroundColor Red
        Write-Host "  Do NOT run against production." -ForegroundColor Red
        Write-Host "============================================================" -ForegroundColor Red
        Write-Host ""

        if (-not $DisableRateLimit) {
            Write-Host "[WARN] Rate limiting is NOT disabled. Results will be capped by rate limits." -ForegroundColor Yellow
            Write-Host "       Use -DisableRateLimit flag for true server capacity measurement." -ForegroundColor Yellow
            Write-Host ""
        }

        Run-K6Test `
            -Name "Maximum User Capacity — Server Break Point Finder (5m45s)" `
            -ScriptFile "max-users-test.js"
    }

    "all" {
        Write-Host "Running FULL CodeRank Load & Stress Test Suite..." -ForegroundColor Yellow
        Write-Host ""

        Run-K6Test -Name "1. Smoke Test"            -ScriptFile "smoke-test.js"
        Run-K6Test -Name "2. API Load Test"         -ScriptFile "api-load-test.js"
        Run-K6Test -Name "3. Execution Stress Test" -ScriptFile "execution-stress-test.js"
        Run-K6Test -Name "4. WebSocket & Polling"   -ScriptFile "websocket-polling-test.js"
        Run-K6Test -Name "5. Submission Load Test"  -ScriptFile "submission-load-test.js"
        # Note: max-users-test and rate-limit-test are NOT in "all" — run them manually
        # as they are destructive (max saturates server, ratelimit needs rate limiting ON)

        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "   All CodeRank Load Tests Completed!" -ForegroundColor Green
        Write-Host "   (max-users-test and rate-limit-test excluded from 'all')" -ForegroundColor DarkGray
        Write-Host "   Run them separately: -Test max or -Test ratelimit" -ForegroundColor DarkGray
        Write-Host "============================================================" -ForegroundColor Green
    }
}
