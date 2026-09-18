# Grafana k6 Load Test Runner for CodeRank
param (
    [string]$Test = "smoke", # smoke, api, execution, all
    [string]$BaseUrl = "http://localhost:3000"
)

# Ensure k6 is accessible in current path
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\k6\k6.exe") {
        $env:Path = "C:\Program Files\k6;$env:Path"
    } else {
        Write-Host "[ERROR] k6 executable not found. Please install Grafana k6." -ForegroundColor Red
        exit 1
    }
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       CodeRank - Grafana k6 Load Testing Suite         " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Target Base URL: $BaseUrl" -ForegroundColor Green
Write-Host "k6 Version: $(k6 version)" -ForegroundColor Gray
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Run-K6Test {
    param (
        [string]$Name,
        [string]$ScriptFile
    )
    Write-Host ">>> Starting: $Name ($ScriptFile)" -ForegroundColor Magenta
    $fullPath = Join-Path $scriptDir $ScriptFile
    $cmd = "k6 run -e BASE_URL=$BaseUrl `"$fullPath`""
    Write-Host "Command: $cmd" -ForegroundColor Gray
    Invoke-Expression $cmd
    Write-Host ">>> Finished: $Name`n" -ForegroundColor Cyan
}

switch ($Test.ToLower()) {
    "smoke" {
        Run-K6Test -Name "Smoke Test (Quick Verification)" -ScriptFile "smoke-test.js"
    }
    "api" {
        Run-K6Test -Name "API & Dashboard Load Test (Concurrent Users)" -ScriptFile "api-load-test.js"
    }
    "execution" {
        Run-K6Test -Name "Compiler Sandbox Stress Test (Docker Sandboxes)" -ScriptFile "execution-stress-test.js"
    }
    "all" {
        Write-Host "Executing Full Test Suite..." -ForegroundColor Yellow
        Run-K6Test -Name "1. Smoke Test" -ScriptFile "smoke-test.js"
        Run-K6Test -Name "2. API & Dashboard Load Test" -ScriptFile "api-load-test.js"
        Run-K6Test -Name "3. Compiler Sandbox Stress Test" -ScriptFile "execution-stress-test.js"
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "       All k6 Load Tests Completed Successfully!        " -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
    }
    default {
        Write-Host "Unknown test '$Test'. Options: smoke, api, execution, all" -ForegroundColor Red
    }
}
