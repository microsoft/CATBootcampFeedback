# ============================================
# Automated Database Migration Script
# Executes MIGRATION_SCRIPT.sql on Azure SQL
# ============================================

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  CAT Bootcamp Feedback - Database Migration  " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - Update these values for your Azure SQL Database
$serverName = "catbootcamp-feedback-server.database.windows.net"
$databaseName = "catbootcamp-feedback-db"
$adminUser = "sqladmin"  # Your SQL admin username

Write-Host "Server: $serverName" -ForegroundColor Yellow
Write-Host "Database: $databaseName" -ForegroundColor Yellow
Write-Host ""

# Prompt for password (secure)
$securePassword = Read-Host "Enter SQL admin password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "Connecting to Azure SQL Database..." -ForegroundColor Green

# Check if SqlServer module is installed
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "SqlServer module not found. Installing..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
    Write-Host "SqlServer module installed successfully!" -ForegroundColor Green
}

Import-Module SqlServer

# Read migration script
$scriptPath = Join-Path $PSScriptRoot "MIGRATION_SCRIPT.sql"

if (-not (Test-Path $scriptPath)) {
    Write-Host "ERROR: MIGRATION_SCRIPT.sql not found!" -ForegroundColor Red
    Write-Host "Expected location: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Reading migration script..." -ForegroundColor Green
$migrationScript = Get-Content -Path $scriptPath -Raw

# Create connection string
$connectionString = "Server=$serverName;Database=$databaseName;User Id=$adminUser;Password=$password;Encrypt=True;TrustServerCertificate=False;"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  EXECUTING MIGRATION                         " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Execute migration
    Write-Host "Executing migration script..." -ForegroundColor Yellow

    Invoke-Sqlcmd -ConnectionString $connectionString `
                  -Query $migrationScript `
                  -QueryTimeout 300 `
                  -Verbose `
                  -OutputSqlErrors $true

    Write-Host ""
    Write-Host "✓ Migration script executed successfully!" -ForegroundColor Green
    Write-Host ""

    # Verification queries
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "  VERIFYING MIGRATION                         " -ForegroundColor Cyan
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""

    # Count tables
    Write-Host "Checking table counts..." -ForegroundColor Yellow
    $counts = Invoke-Sqlcmd -ConnectionString $connectionString -Query @"
        SELECT
            (SELECT COUNT(*) FROM Modules) AS ModuleCount,
            (SELECT COUNT(*) FROM Events) AS EventCount,
            (SELECT COUNT(*) FROM Feedback) AS FeedbackCount
"@

    Write-Host "  Modules: $($counts.ModuleCount)" -ForegroundColor Green
    Write-Host "  Events: $($counts.EventCount)" -ForegroundColor Green
    Write-Host "  Feedback: $($counts.FeedbackCount)" -ForegroundColor Green
    Write-Host ""

    # Check views
    Write-Host "Checking views..." -ForegroundColor Yellow
    $views = Invoke-Sqlcmd -ConnectionString $connectionString -Query @"
        SELECT * FROM vw_EventsWithModules
"@

    if ($views) {
        Write-Host "  ✓ vw_EventsWithModules: $($views.Count) records" -ForegroundColor Green
    }

    # Test stored procedure
    Write-Host "Testing stored procedures..." -ForegroundColor Yellow
    $testProc = Invoke-Sqlcmd -ConnectionString $connectionString -Query @"
        EXEC sp_GetEventByCode 'CSA1B2C3'
"@

    if ($testProc) {
        Write-Host "  ✓ sp_GetEventByCode: Working" -ForegroundColor Green
        Write-Host "    Event: $($testProc.EventCode) - $($testProc.ModuleName)" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host "  ✓ MIGRATION COMPLETED SUCCESSFULLY!         " -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. API endpoints are already deployed" -ForegroundColor White
    Write-Host "  2. Frontend updates will be deployed next" -ForegroundColor White
    Write-Host "  3. Test the feedback form and live counter" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Red
    Write-Host "  ✗ MIGRATION FAILED                          " -ForegroundColor Red
    Write-Host "===============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your data is safe - old Events table is backed up." -ForegroundColor Yellow
    Write-Host "Check the error message above and:" -ForegroundColor Yellow
    Write-Host "  1. Verify connection details are correct" -ForegroundColor White
    Write-Host "  2. Ensure SQL admin credentials are valid" -ForegroundColor White
    Write-Host "  3. Check firewall allows your IP address" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
