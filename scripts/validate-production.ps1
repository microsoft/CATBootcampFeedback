<#
.SYNOPSIS
    Validate production environment is working correctly

.DESCRIPTION
    Runs comprehensive checks on production frontend, backend, and database

.PARAMETER DatabasePassword
    Optional production database password for database connectivity test
#>

param(
    [Parameter(Mandatory=$false)]
    [SecureString]$DatabasePassword
)

$ErrorActionPreference = 'Continue'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Production Environment Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true
$prodFrontend = "https://lively-ocean-076d52c0f-2.azurestaticapps.net"
$prodBackend = "https://cat-bootcamp-api-prod.azurewebsites.net"

# Test 1: Frontend availability
Write-Host "Test 1: Frontend Availability" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $prodFrontend -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✅ Frontend is accessible (HTTP $($response.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ Frontend is not accessible: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 2: Backend health check (if health endpoint exists)
Write-Host "Test 2: Backend Availability" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$prodBackend/api/GetEvents" -TimeoutSec 10 -ErrorAction Stop
    $count = $response.Count
    if ($count -ge 0) {
        Write-Host "  ✅ Backend API is responding" -ForegroundColor Green
        Write-Host "  ℹ️  Events count: $count" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  ❌ Backend API call failed: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 3: Events API
Write-Host "Test 3: Events API Detailed Check" -ForegroundColor Yellow
try {
    $events = Invoke-RestMethod -Uri "$prodBackend/api/GetEvents" -TimeoutSec 10
    if ($events -and $events.Count -gt 0) {
        Write-Host "  ✅ Events API returned $($events.Count) events" -ForegroundColor Green
        $activeEvents = ($events | Where-Object { $_.IsActive -eq $true }).Count
        Write-Host "  ℹ️  Active events: $activeEvents" -ForegroundColor Cyan
    } else {
        Write-Host "  ⚠️  Events API returned 0 events (may be expected for new environment)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Events API failed: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 4: Modules API
Write-Host "Test 4: Modules API Check" -ForegroundColor Yellow
try {
    $modules = Invoke-RestMethod -Uri "$prodBackend/api/GetModules" -TimeoutSec 10
    if ($modules) {
        Write-Host "  ✅ Modules API returned $($modules.Count) modules" -ForegroundColor Green
        $activeModules = ($modules | Where-Object { $_.IsActive -eq $true }).Count
        Write-Host "  ℹ️  Active modules: $activeModules" -ForegroundColor Cyan
    } else {
        Write-Host "  ⚠️  Modules API returned 0 modules" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Modules API failed: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 5: Feedback API
Write-Host "Test 5: Feedback API Check" -ForegroundColor Yellow
try {
    $feedback = Invoke-RestMethod -Uri "$prodBackend/api/GetAllFeedback" -TimeoutSec 10
    if ($feedback) {
        Write-Host "  ✅ Feedback API returned $($feedback.Count) feedback entries" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Feedback API returned 0 feedback entries (may be expected)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Feedback API failed: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Test 6: Database connectivity (optional, requires password)
if ($DatabasePassword) {
    Write-Host "Test 6: Database Connectivity" -ForegroundColor Yellow
    try {
        $credential = New-Object System.Management.Automation.PSCredential('sqladmin', $DatabasePassword)
        $result = Invoke-Sqlcmd `
            -ServerInstance 'cat-bootcamp-sql-prod.database.windows.net' `
            -Database 'CATBootcampFeedback-Prod' `
            -Credential $credential `
            -Query 'SELECT DB_NAME() AS DatabaseName, COUNT(*) AS EventCount FROM Events WHERE IsDeleted = 0' `
            -Encrypt Mandatory `
            -TrustServerCertificate `
            -ConnectionTimeout 10 `
            -ErrorAction Stop

        Write-Host "  ✅ Database connected: $($result.DatabaseName)" -ForegroundColor Green
        Write-Host "  ℹ️  Events in database: $($result.EventCount)" -ForegroundColor Cyan
    } catch {
        Write-Host "  ❌ Database connection failed: $($_.Exception.Message)" -ForegroundColor Red
        $allPassed = $false
    }
    Write-Host ""
} else {
    Write-Host "Test 6: Database Connectivity" -ForegroundColor Yellow
    Write-Host "  ⊘  Skipped (no password provided)" -ForegroundColor Gray
    Write-Host "  ℹ️  Run with -DatabasePassword parameter to test database" -ForegroundColor Cyan
    Write-Host ""
}

# Test 7: CORS Configuration
Write-Host "Test 7: CORS Configuration" -ForegroundColor Yellow
Write-Host "  ℹ️  Manual verification required:" -ForegroundColor Cyan
Write-Host "    1. Open browser to $prodFrontend" -ForegroundColor Gray
Write-Host "    2. Open Developer Console (F12)" -ForegroundColor Gray
Write-Host "    3. Verify no CORS errors appear" -ForegroundColor Gray
Write-Host "    4. Check API calls go to: $prodBackend/api" -ForegroundColor Gray
Write-Host ""

# Test 8: Environment Detection
Write-Host "Test 8: Environment Detection" -ForegroundColor Yellow
Write-Host "  ℹ️  Manual verification required:" -ForegroundColor Cyan
Write-Host "    1. Open browser to $prodFrontend" -ForegroundColor Gray
Write-Host "    2. Open Developer Console (F12)" -ForegroundColor Gray
Write-Host "    3. Look for console log: 'Environment: PRODUCTION'" -ForegroundColor Gray
Write-Host "    4. Verify apiBaseUrl shows production backend URL" -ForegroundColor Gray
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✅ All automated validation tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Perform manual browser tests" -ForegroundColor Gray
    Write-Host "  2. Test admin login flow" -ForegroundColor Gray
    Write-Host "  3. Verify event creation" -ForegroundColor Gray
    Write-Host "  4. Submit test feedback" -ForegroundColor Gray
} else {
    Write-Host "❌ Some validation tests failed" -ForegroundColor Red
    Write-Host "Review errors above and check:" -ForegroundColor Yellow
    Write-Host "  - Azure Portal for resource status" -ForegroundColor Gray
    Write-Host "  - Functions App logs" -ForegroundColor Gray
    Write-Host "  - Database firewall rules" -ForegroundColor Gray
    Write-Host "  - GitHub secrets configuration" -ForegroundColor Gray
    exit 1
}
Write-Host "========================================" -ForegroundColor Cyan

# Display environment URLs
Write-Host ""
Write-Host "Production Environment URLs:" -ForegroundColor Cyan
Write-Host "  Frontend: $prodFrontend" -ForegroundColor White
Write-Host "  Backend:  $prodBackend/api" -ForegroundColor White
Write-Host "  Database: cat-bootcamp-sql-prod.database.windows.net" -ForegroundColor White
