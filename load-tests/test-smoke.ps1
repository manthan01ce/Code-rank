#!/usr/bin/env pwsh
# Quick script to run smoke test and verify improvements

Write-Host "🔥 CodeRank Smoke Test Runner" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if k6 is installed
Write-Host "Checking for k6..." -ForegroundColor Yellow
if (!(Get-Command k6 -ErrorAction SilentlyContinue)) {
    Write-Host "❌ k6 is not installed. Please install it first:" -ForegroundColor Red
    Write-Host "   winget install k6" -ForegroundColor White
    exit 1
}
Write-Host "✓ k6 found`n" -ForegroundColor Green

# Check if server is running
Write-Host "Checking if server is running on http://localhost:3000..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✓ Server is running`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running on http://localhost:3000" -ForegroundColor Red
    Write-Host "   Please start the server first with: npm run start" -ForegroundColor White
    exit 1
}

# Run the smoke test
Write-Host "Running smoke test..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

$testFile = Join-Path $PSScriptRoot "smoke-test.js"
$reportDir = Join-Path $PSScriptRoot "reports"

# Create reports directory if it doesn't exist
if (!(Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir | Out-Null
}

# Run k6 test
k6 run $testFile

$exitCode = $LASTEXITCODE

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if ($exitCode -eq 0) {
    Write-Host "`n✅ Smoke test PASSED!" -ForegroundColor Green
    Write-Host "   All thresholds met successfully" -ForegroundColor Green
} else {
    Write-Host "`n❌ Smoke test FAILED!" -ForegroundColor Red
    Write-Host "   Some thresholds were not met" -ForegroundColor Red
    Write-Host "`n   Check the output above for details" -ForegroundColor Yellow
    Write-Host "   Review SMOKE_TEST_IMPROVEMENTS.md for troubleshooting" -ForegroundColor Yellow
}

Write-Host "`n📊 Test Summary:" -ForegroundColor Cyan
Write-Host "   - Test file: smoke-test.js" -ForegroundColor White
Write-Host "   - Target: http://localhost:3000" -ForegroundColor White
Write-Host "   - P95 Threshold: < 800ms" -ForegroundColor White
Write-Host "   - Error Threshold: < 1%" -ForegroundColor White

exit $exitCode
