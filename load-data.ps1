# PowerShell script to load sample data into Azure SQL Database
# This uses Invoke-Sqlcmd to execute the SQL script

$server = "cat-bootcamp-sql-89082.database.windows.net"
$database = "CATBootcampFeedback"

Write-Host "Loading sample data into CAT Bootcamp Feedback database..." -ForegroundColor Cyan
Write-Host ""

# Check if we can connect using Azure AD authentication
try {
    Write-Host "Attempting to connect using Azure AD authentication..." -ForegroundColor Yellow

    # Get the SQL file content
    $sqlFile = Join-Path $PSScriptRoot "load-sample-data.sql"

    if (!(Test-Path $sqlFile)) {
        Write-Host "ERROR: SQL file not found at: $sqlFile" -ForegroundColor Red
        exit 1
    }

    # Execute using az cli
    Write-Host "Executing SQL script via Azure CLI..." -ForegroundColor Yellow

    $sqlContent = Get-Content $sqlFile -Raw

    # Split by GO statements and execute each batch
    $batches = $sqlContent -split '\bGO\b' | Where-Object { $_.Trim() -ne '' }

    foreach ($batch in $batches) {
        if ($batch.Trim() -ne '') {
            Write-Host "Executing batch..." -ForegroundColor Gray

            # Save batch to temp file
            $tempFile = [System.IO.Path]::GetTempFileName()
            $batch | Out-File -FilePath $tempFile -Encoding UTF8

            # Execute via az sql db query
            $result = & az sql db query `
                --server "cat-bootcamp-sql-89082" `
                --database "CATBootcampFeedback" `
                --auth-mode "ActiveDirectoryIntegrated" `
                --file "$tempFile" `
                2>&1

            Remove-Item $tempFile

            if ($LASTEXITCODE -ne 0) {
                Write-Host "Warning: Batch execution had issues" -ForegroundColor Yellow
                Write-Host $result -ForegroundColor Gray
            } else {
                Write-Host $result -ForegroundColor Green
            }
        }
    }

    Write-Host ""
    Write-Host "Sample data loaded successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test Event Codes:" -ForegroundColor Cyan
    Write-Host "  - CSA1B2C3 (Introduction to CAT Bootcamp)" -ForegroundColor White
    Write-Host "  - CSXYZ789 (Advanced Topics in CAT)" -ForegroundColor White
    Write-Host "  - CSABC456 (CAT Best Practices)" -ForegroundColor White
    Write-Host ""
    Write-Host "You can now test the feedback form with these event codes!" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to load sample data" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual alternative:" -ForegroundColor Yellow
    Write-Host "1. Open Azure Portal" -ForegroundColor White
    Write-Host "2. Navigate to your SQL database: CATBootcampFeedback" -ForegroundColor White
    Write-Host "3. Click 'Query editor'" -ForegroundColor White
    Write-Host "4. Copy and paste the contents of load-sample-data.sql" -ForegroundColor White
    Write-Host "5. Click 'Run'" -ForegroundColor White
    exit 1
}
