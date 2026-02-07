# Fix Production Key Vault Configuration
$ErrorActionPreference = "Stop"

Write-Host "Fixing Production Key Vault Configuration" -ForegroundColor Cyan

$KV_RESOURCE_GROUP = "cat-bootcamp-rg"
$PROD_RESOURCE_GROUP = "cat-bootcamp-prod-rg"
$PROD_KEYVAULT_NAME = "cat-bootcamp-kv-prod"
$PROD_FUNCTION_APP = "cat-bootcamp-api-prod"
$SECRET_NAME = "JWT-SECRET"

# Enable managed identity on production Function App
Write-Host "Enabling managed identity on production Function App..."
$PRINCIPAL_ID = & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' functionapp identity assign --name $PROD_FUNCTION_APP --resource-group $PROD_RESOURCE_GROUP --query principalId --output tsv
Write-Host "Principal ID: $PRINCIPAL_ID" -ForegroundColor Green

# Wait for propagation
Write-Host "Waiting for identity propagation..."
Start-Sleep -Seconds 10

# Grant access to Key Vault
Write-Host "Granting Key Vault access..."
& 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' keyvault set-policy --name $PROD_KEYVAULT_NAME --resource-group $KV_RESOURCE_GROUP --object-id $PRINCIPAL_ID --secret-permissions get list --output none
Write-Host "Access granted" -ForegroundColor Green

# Get secret URI
$SECRET_URI = & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' keyvault secret show --vault-name $PROD_KEYVAULT_NAME --resource-group $KV_RESOURCE_GROUP --name $SECRET_NAME --query id --output tsv
Write-Host "Secret URI: $SECRET_URI"

# Configure Function App
Write-Host "Configuring production Function App..."
& 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' functionapp config appsettings set --name $PROD_FUNCTION_APP --resource-group $PROD_RESOURCE_GROUP --settings "JWT_SECRET=@Microsoft.KeyVault(SecretUri=$SECRET_URI)" --output none
Write-Host "Production Function App configured successfully!" -ForegroundColor Green
