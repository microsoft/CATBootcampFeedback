# Azure Key Vault Provisioning Script (Automated - Simple)
$ErrorActionPreference = "Stop"

Write-Host "Azure Key Vault Provisioning Started" -ForegroundColor Cyan

# Configuration
$RESOURCE_GROUP = "cat-bootcamp-rg"
$LOCATION = "centralus"
$DEV_KEYVAULT_NAME = "cat-bootcamp-kv-dev"
$PROD_KEYVAULT_NAME = "cat-bootcamp-kv-prod"
$DEV_FUNCTION_APP = "cat-bootcamp-api"
$PROD_FUNCTION_APP = "cat-bootcamp-api-prod"
$SECRET_NAME = "JWT-SECRET"
$DEV_JWT_SECRET = "qM4bhPGVy5NVP6AZnzSlQDITBRbAoCHqusURNn1amw0="
$PROD_JWT_SECRET = "rLyDbvhzCoNjdIVbkqjMmCdIN1Phg753NlgQ4B5rDgo="

Write-Host "Configuration loaded"

# Create resource group
Write-Host "Checking resource group..."
try {
    $null = & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' group show --name $RESOURCE_GROUP 2>$null
    Write-Host "Resource group exists" -ForegroundColor Green
} catch {
    Write-Host "Creating resource group..."
    & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' group create --name $RESOURCE_GROUP --location $LOCATION
    Write-Host "Resource group created" -ForegroundColor Green
}

# Function to provision Key Vault
function Provision-KeyVault {
    param([string]$Env, [string]$KeyVaultName, [string]$FunctionApp, [string]$JWTSecret)

    Write-Host ""
    Write-Host "Provisioning $Env environment..." -ForegroundColor Cyan
    Write-Host "Key Vault: $KeyVaultName"

    # Create Key Vault
    Write-Host "Creating Key Vault..."
    try {
        $null = & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' keyvault show --name $KeyVaultName 2>$null
        Write-Host "Key Vault exists" -ForegroundColor Yellow
    } catch {
        & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' keyvault create --name $KeyVaultName --resource-group $RESOURCE_GROUP --location $LOCATION --enable-rbac-authorization false --enabled-for-deployment true --enabled-for-template-deployment true
        Write-Host "Key Vault created" -ForegroundColor Green
    }

    # Store JWT secret
    Write-Host "Storing JWT secret..."
    & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' keyvault secret set --vault-name $KeyVaultName --name $SECRET_NAME --value $JWTSecret --output none
    Write-Host "JWT secret stored" -ForegroundColor Green

    # Enable managed identity
    Write-Host "Configuring managed identity..."
    $PRINCIPAL_ID = & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' functionapp identity assign --name $FunctionApp --resource-group $RESOURCE_GROUP --query principalId --output tsv
    Write-Host "Principal ID: $PRINCIPAL_ID"

    # Wait for propagation
    Write-Host "Waiting for identity propagation..."
    Start-Sleep -Seconds 10

    # Grant access
    Write-Host "Granting Key Vault access..."
    & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' keyvault set-policy --name $KeyVaultName --object-id $PRINCIPAL_ID --secret-permissions get list --output none
    Write-Host "Access granted" -ForegroundColor Green

    # Get secret URI
    $SECRET_URI = & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' keyvault secret show --vault-name $KeyVaultName --name $SECRET_NAME --query id --output tsv
    Write-Host "Secret URI: $SECRET_URI"

    # Configure Function App
    Write-Host "Configuring Function App..."
    & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd' functionapp config appsettings set --name $FunctionApp --resource-group $RESOURCE_GROUP --settings "JWT_SECRET=@Microsoft.KeyVault(SecretUri=$SECRET_URI)" --output none
    Write-Host "Function App configured" -ForegroundColor Green
}

# Provision environments
Provision-KeyVault -Env "DEVELOPMENT" -KeyVaultName $DEV_KEYVAULT_NAME -FunctionApp $DEV_FUNCTION_APP -JWTSecret $DEV_JWT_SECRET
Provision-KeyVault -Env "PRODUCTION" -KeyVaultName $PROD_KEYVAULT_NAME -FunctionApp $PROD_FUNCTION_APP -JWTSecret $PROD_JWT_SECRET

Write-Host ""
Write-Host "Provisioning Complete!" -ForegroundColor Green
Write-Host "Development Key Vault: $DEV_KEYVAULT_NAME"
Write-Host "Production Key Vault: $PROD_KEYVAULT_NAME"
Write-Host "Function Apps will restart automatically"
