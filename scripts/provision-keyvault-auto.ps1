# Azure Key Vault Provisioning Script (Automated)
# This script provisions Azure Key Vault resources for both dev and prod environments

$ErrorActionPreference = "Stop"

Write-Host "🔐 CAT Bootcamp - Azure Key Vault Provisioning (Automated)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$RESOURCE_GROUP = "cat-bootcamp-rg"
$LOCATION = "centralus"
$DEV_KEYVAULT_NAME = "cat-bootcamp-kv-dev"
$PROD_KEYVAULT_NAME = "cat-bootcamp-kv-prod"
$DEV_FUNCTION_APP = "cat-bootcamp-api"
$PROD_FUNCTION_APP = "cat-bootcamp-api-prod"
$SECRET_NAME = "JWT-SECRET"

# Pre-generated secrets
$DEV_JWT_SECRET = "qM4bhPGVy5NVP6AZnzSlQDITBRbAoCHqusURNn1amw0="
$PROD_JWT_SECRET = "rLyDbvhzCoNjdIVbkqjMmCdIN1Phg753NlgQ4B5rDgo="

Write-Host "📋 Configuration:"
Write-Host "  Resource Group: $RESOURCE_GROUP"
Write-Host "  Location: $LOCATION"
Write-Host "  Dev Key Vault: $DEV_KEYVAULT_NAME"
Write-Host "  Prod Key Vault: $PROD_KEYVAULT_NAME"
Write-Host "  Dev JWT Secret: ****"
Write-Host "  Prod JWT Secret: ****"
Write-Host ""

# Create resource group if it doesn't exist
Write-Host "📦 Checking resource group..." -ForegroundColor Yellow
try {
    $null = az group show --name $RESOURCE_GROUP 2>$null
    Write-Host "✅ Resource group exists" -ForegroundColor Green
} catch {
    Write-Host "Creating resource group $RESOURCE_GROUP..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
    Write-Host "✅ Resource group created" -ForegroundColor Green
}
Write-Host ""

# Function to provision Key Vault
function Provision-KeyVault {
    param(
        [string]$Env,
        [string]$KeyVaultName,
        [string]$FunctionApp,
        [string]$JWTSecret
    )

    Write-Host "🏗️  Provisioning Key Vault for $Env environment..." -ForegroundColor Cyan
    Write-Host "  Key Vault: $KeyVaultName"
    Write-Host ""

    # Create Key Vault
    Write-Host "  Creating Key Vault..."
    try {
        $null = az keyvault show --name $KeyVaultName 2>$null
        Write-Host "  ⚠️  Key Vault already exists, updating..." -ForegroundColor Yellow
    } catch {
        Write-Host "  Creating new Key Vault..."
        az keyvault create `
            --name $KeyVaultName `
            --resource-group $RESOURCE_GROUP `
            --location $LOCATION `
            --enable-rbac-authorization false `
            --enabled-for-deployment true `
            --enabled-for-template-deployment true
        Write-Host "  ✅ Key Vault created" -ForegroundColor Green
    }

    # Store JWT secret
    Write-Host "  Storing JWT secret..."
    az keyvault secret set `
        --vault-name $KeyVaultName `
        --name $SECRET_NAME `
        --value $JWTSecret `
        --output none
    Write-Host "  ✅ JWT secret stored" -ForegroundColor Green

    # Get Function App Managed Identity
    Write-Host "  Configuring Function App managed identity..."

    # Enable system-assigned managed identity
    $PRINCIPAL_ID = az functionapp identity assign `
        --name $FunctionApp `
        --resource-group $RESOURCE_GROUP `
        --query principalId `
        --output tsv

    Write-Host "  Function App Principal ID: $PRINCIPAL_ID"

    # Wait a moment for identity to propagate
    Write-Host "  Waiting for identity to propagate..."
    Start-Sleep -Seconds 10

    # Grant Function App access to Key Vault
    Write-Host "  Granting Key Vault access to Function App..."
    az keyvault set-policy `
        --name $KeyVaultName `
        --object-id $PRINCIPAL_ID `
        --secret-permissions get list `
        --output none
    Write-Host "  ✅ Access granted" -ForegroundColor Green

    # Get secret URI
    $SECRET_URI = az keyvault secret show `
        --vault-name $KeyVaultName `
        --name $SECRET_NAME `
        --query id `
        --output tsv

    Write-Host "  Secret URI: $SECRET_URI"

    # Configure Function App to use Key Vault reference
    Write-Host "  Configuring Function App settings..."
    az functionapp config appsettings set `
        --name $FunctionApp `
        --resource-group $RESOURCE_GROUP `
        --settings "JWT_SECRET=@Microsoft.KeyVault(SecretUri=$SECRET_URI)" `
        --output none
    Write-Host "  ✅ Function App configured" -ForegroundColor Green
    Write-Host ""
}

# Provision Development environment
Provision-KeyVault -Env "DEVELOPMENT" -KeyVaultName $DEV_KEYVAULT_NAME -FunctionApp $DEV_FUNCTION_APP -JWTSecret $DEV_JWT_SECRET

# Provision Production environment
Provision-KeyVault -Env "PRODUCTION" -KeyVaultName $PROD_KEYVAULT_NAME -FunctionApp $PROD_FUNCTION_APP -JWTSecret $PROD_JWT_SECRET

Write-Host "🎉 Provisioning Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:"
Write-Host "  ✅ Development Key Vault: $DEV_KEYVAULT_NAME"
Write-Host "  ✅ Production Key Vault: $PROD_KEYVAULT_NAME"
Write-Host "  ✅ JWT secrets stored securely"
Write-Host "  ✅ Function Apps configured with Key Vault references"
Write-Host ""
Write-Host "🔍 Verification:"
Write-Host "  You can verify the configuration with:"
Write-Host "  az functionapp config appsettings list --name $DEV_FUNCTION_APP --resource-group $RESOURCE_GROUP"
Write-Host "  az functionapp config appsettings list --name $PROD_FUNCTION_APP --resource-group $RESOURCE_GROUP"
Write-Host ""
Write-Host "⚠️  Important: The Function Apps will restart automatically to apply the new settings" -ForegroundColor Yellow
Write-Host ""
Write-Host "[SUCCESS] Development environment is now fully configured with Azure Key Vault!" -ForegroundColor Green
