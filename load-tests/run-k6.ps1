# ========================================================
# Grafana k6 Load & Stress Test Runner for CodeRank v1.1
# ========================================================
param (
    [ValidateSet("smoke", "api", "execution", "all")]
    [string]$Test = "smoke",
    [string]$BaseUrl = "http://localhost:3000",
    [string]$JwtToken = "",
    [switch]$HtmlReport
)

# 1. Locate k6 executable
$k6Path = "k6"
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\k6\k6.exe") {
        $env:Path = "C:\Program Files\k6;$env:Path"
    } elseif (Test-Path "$env:LOCALAPPDATA\Programs\k6\k6.exe") {
        $env:Path = "$env:LOCALAPPDATA\Programs\k6;$env:Path"
    } else {
        Write-Host "[ERROR] k6 executable not found. Please install Grafana k6 (winget install k6 / choco install k6)." -ForegroundColor Red
        exit 1
    }
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       CodeRank v1.1 — Grafana k6 Load Test Suite       " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Target URL:   $BaseUrl" -ForegroundColor Green
Write-Host "k6 Engine:    $(k6 version)" -ForegroundColor Gray
if ($JwtToken) {
    Write-Host "Auth Token:   Configured (Bearer ...)" -ForegroundColor Gray
}
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Run-K6Test {
    param (
        [string]$Name,
        [string]$ScriptFile
    )
    Write-Host ">>> [RUNNING] $Name ($ScriptFile)" -ForegroundColor Magenta
    $fullPath = Join-Path $scriptDir $ScriptFile
    
    $envArgs = "-e BASE_URL=$BaseUrl"
    if ($JwtToken) {
        $envArgs += " -e JWT_TOKEN=$JwtToken"
    }

    $cmd = "k6 run $envArgs `"$fullPath`""
    Write-Host "Executing: $cmd" -ForegroundColor DarkGray
    Invoke-Expression $cmd

    if ($LASTEXITCODE -eq 0) {
        Write-Host ">>> [PASSED] $Name`n" -ForegroundColor Green
    } else {
        Write-Host ">>> [COMPLETED WITH THRESHOLD ALERTS] $Name`n" -ForegroundColor Yellow
    }
}

switch ($Test.ToLower()) {
    "smoke" {
        Run-K6Test -Name "1. Smoke Test (Quick Diagnostic Verification)" -ScriptFile "smoke-test.js"
    }
    "api" {
        Run-K6Test -Name "2. API & Gateway Load Test (Concurrent Users)" -ScriptFile "api-load-test.js"
    }
    "execution" {
        Run-K6Test -Name "3. Execution Engine & BullMQ Stress Test" -ScriptFile "execution-stress-test.js"
    }
    "all" {
        Write-Host "Executing Full CodeRank Load & Stress Test Suite..." -ForegroundColor Yellow
        Run-K6Test -Name "1. Smoke Test" -ScriptFile "smoke-test.js"
        Run-K6Test -Name "2. API & Gateway Load Test" -ScriptFile "api-load-test.js"
        Run-K6Test -Name "3. Execution Engine & BullMQ Stress Test" -ScriptFile "execution-stress-test.js"
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "       All k6 Load Tests Completed!                     " -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
    }
}
