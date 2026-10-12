#!/usr/bin/env pwsh
# API Load Test Runner Script

Write-Host "🚀 CodeRank API Load Test Runner" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

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
    Write-Host "✓ Server is running" -ForegroundColor Green
    
    # Parse health check response
    $health = $response.Content | ConvertFrom-Json
    if ($health.status -eq "healthy") {
        Write-Host "✓ Health check: HEALTHY" -ForegroundColor Green
        if ($health.services.database.status -eq "healthy") {
            Write-Host "✓ Database: CONNECTED" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Database: $($health.services.database.status)" -ForegroundColor Yellow
        }
        if ($health.services.queue) {
            Write-Host "✓ Queue: $($health.services.queue.status)" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️  Health check: $($health.status)" -ForegroundColor Yellow
    }
    Write-Host ""
} catch {
    Write-Host "❌ Server is not running on http://localhost:3000" -ForegroundColor Red
    Write-Host "   Please start the server first with:" -ForegroundColor White
    Write-Host "   cd apps\web" -ForegroundColor White
    Write-Host "   `$env:NODE_ENV=`"production`"" -ForegroundColor White
    Write-Host "   npm run start`n" -ForegroundColor White
    exit 1
}

# Check for JWT token (optional)
$jwtToken = $env:JWT_TOKEN
if ($jwtToken) {
    Write-Host "✓ JWT_TOKEN found (authenticated tests enabled)" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No JWT_TOKEN set (running unauthenticated tests only)" -ForegroundColor Cyan
    Write-Host "   To test authenticated endpoints, set: `$env:JWT_TOKEN=`"your-token`"" -ForegroundColor Gray
}
Write-Host ""

# Display test configuration
Write-Host "📊 Test Configuration:" -ForegroundColor Cyan
Write-Host "   Target URL:    http://localhost:3000" -ForegroundColor White
Write-Host "   Duration:      ~2 minutes" -ForegroundColor White
Write-Host "   Peak VUs:      150 concurrent users" -ForegroundColor White
Write-Host "   P95 Target:    < 2000ms" -ForegroundColor White
Write-Host "   Error Target:  < 5%" -ForegroundColor White
Write-Host ""

# Confirm before running
Write-Host "Ready to start API load test?" -ForegroundColor Yellow
Write-Host "Press [Enter] to continue or [Ctrl+C] to cancel..." -ForegroundColor Gray
Read-Host

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

# Run the test
$testFile = Join-Path $PSScriptRoot "api-load-test.js"
$reportDir = Join-Path $PSScriptRoot "reports"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = Join-Path $reportDir "api-load-test-$timestamp.txt"

# Create reports directory if it doesn't exist
if (!(Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir | Out-Null
}

Write-Host "Starting API load test..." -ForegroundColor Yellow
Write-Host "Report will be saved to: $reportFile" -ForegroundColor Gray
Write-Host ""

# Run k6 and capture output
$testOutput = & k6 run $testFile 2>&1
$exitCode = $LASTEXITCODE

# Save output to file
$testOutput | Out-File -FilePath $reportFile -Encoding UTF8

# Display output
$testOutput

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Analyze results
if ($exitCode -eq 0) {
    Write-Host "`n✅ API Load Test PASSED!" -ForegroundColor Green
    Write-Host "   All thresholds met successfully" -ForegroundColor Green
    
    # Extract key metrics from output
    $p95Line = $testOutput | Select-String "http_req_duration.*p\(95\)"
    $errorLine = $testOutput | Select-String "http_req_failed.*rate"
    
    if ($p95Line) {
        Write-Host "`n   Key Metrics:" -ForegroundColor Cyan
        Write-Host "   $p95Line" -ForegroundColor White
    }
    if ($errorLine) {
        Write-Host "   $errorLine" -ForegroundColor White
    }
} else {
    Write-Host "`n❌ API Load Test FAILED!" -ForegroundColor Red
    Write-Host "   Some thresholds were not met" -ForegroundColor Red
    
    # Try to extract which thresholds failed
    $failedThresholds = $testOutput | Select-String "✗" | Select-Object -First 5
    if ($failedThresholds) {
        Write-Host "`n   Failed Thresholds:" -ForegroundColor Yellow
        $failedThresholds | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`n   Troubleshooting Steps:" -ForegroundColor Yellow
    Write-Host "   1. Check server logs for errors" -ForegroundColor White
    Write-Host "   2. Verify database is responsive" -ForegroundColor White
    Write-Host "   3. Check Redis connection" -ForegroundColor White
    Write-Host "   4. Review API_TEST_IMPROVEMENTS.md" -ForegroundColor White
    Write-Host "   5. Consider reducing peak VUs (150 → 100)" -ForegroundColor White
}

Write-Host "`n📄 Full Report:" -ForegroundColor Cyan
Write-Host "   $reportFile" -ForegroundColor White

Write-Host "`n📊 Test Summary:" -ForegroundColor Cyan
Write-Host "   - Test file: api-load-test.js" -ForegroundColor White
Write-Host "   - Target: http://localhost:3000" -ForegroundColor White
Write-Host "   - Peak VUs: 150" -ForegroundColor White
Write-Host "   - Duration: ~2 minutes" -ForegroundColor White
Write-Host "   - P95 Threshold: < 2000ms" -ForegroundColor White
Write-Host "   - Error Threshold: < 5%" -ForegroundColor White

# Offer to open report
Write-Host "`nOpen full report? (Y/N): " -ForegroundColor Yellow -NoNewline
$openReport = Read-Host
if ($openReport -eq "Y" -or $openReport -eq "y") {
    notepad $reportFile
}

exit $exitCode
