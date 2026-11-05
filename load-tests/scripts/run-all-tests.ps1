# ============================================================
# CodeRank — Run All k6 Tests and Generate Report
# ============================================================

param (
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"
$reportsDir = "load-tests\reports"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$summaryFile = "$reportsDir\test-summary-$timestamp.md"

# Create reports directory
New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   CodeRank Full Load Test Suite" -ForegroundColor Yellow
Write-Host "   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Initialize summary
@"
# CodeRank Load Test Results
## Test Run: $timestamp
## Server: $BaseUrl

---

## Test Results Summary

"@ | Out-File $summaryFile

# Test configurations
$tests = @(
    @{ Name = "Smoke Test"; Script = "smoke"; File = "01-smoke"; Duration = "20s" },
    @{ Name = "API Load Test"; Script = "api"; File = "02-api"; Duration = "2m" },
    @{ Name = "Execution Stress Test"; Script = "execution"; File = "03-execution"; Duration = "2m" },
    @{ Name = "WebSocket & Polling Test"; Script = "websocket"; File = "04-websocket"; Duration = "2.5m" },
    @{ Name = "Submission Load Test"; Script = "submission"; File = "05-submission"; Duration = "2.5m" },
    @{ Name = "Maximum Capacity Test"; Script = "max"; File = "06-max-users"; Duration = "5.5m" }
)

$results = @()

foreach ($test in $tests) {
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    Write-Host "Running: $($test.Name)" -ForegroundColor Cyan
    Write-Host "Expected Duration: $($test.Duration)" -ForegroundColor Gray
    Write-Host ""
    
    $outputFile = "$reportsDir\$($test.File)-results.txt"
    $startTime = Get-Date
    
    try {
        .\load-tests\run-k6.ps1 -Test $test.Script -BaseUrl $BaseUrl -DisableRateLimit -DisableCache | Tee-Object -FilePath $outputFile
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
    }
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    $status = if ($exitCode -eq 0) { "✅ PASSED" } else { "⚠️ FAILED" }
    
    $results += @{
        Name = $test.Name
        Status = $status
        Duration = "{0:N1}s" -f $duration
        File = $outputFile
    }
    
    Write-Host ""
    Write-Host "$status - Completed in $("{0:N1}s" -f $duration)" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Yellow" })
    Write-Host ""
    
    # Add to summary
    "### $($test.Name)
- **Status**: $status
- **Duration**: $("{0:N1}s" -f $duration)
- **Report**: ``$($test.File)-results.txt``

" | Out-File $summaryFile -Append
    
    Start-Sleep -Seconds 3
}

# Generate final summary
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Test Suite Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$results | ForEach-Object {
    Write-Host "$($_.Status) $($_.Name) - $($_.Duration)" -ForegroundColor $(if ($_.Status -match "PASSED") { "Green" } else { "Yellow" })
}

Write-Host ""
Write-Host "Full report saved to: $summaryFile" -ForegroundColor Cyan
Write-Host ""

# Display summary file location
Get-Item $summaryFile
